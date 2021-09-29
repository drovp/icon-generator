/**
 * Adapted from: https://github.com/akabekobeko/npm-icon-gen
 */
import {PNG} from 'pngjs';
import {packICNS} from './rle';
import {Image} from '../types';

/** Information of pack bit. */
type PackBitBody = {
	/** Colors of compressed by ICNS RLE. */
	colors: number[];
	/** Masks of alpha color. */
	masks: number[];
};

/** Icon information in ICNS. */
type IconInfo = {
	type: string;
	size: number;
	mask?: string;
};

/** Options of ICNS. */
export type ICNSOptions = {
	/** Name of an output file. */
	name?: string;
	/** Structure of an image sizes. */
	sizes?: number[];
};

/**
 * Sizes required for the ICNS file.
 * @type {Array}
 */
export const REQUIRED_IMAGE_SIZES = [16, 32, 64, 128, 256, 512, 1024];

/**
 * The size of the ICNS header.
 * @type {Number}
 */
const HEADER_SIZE = 8;

/**
 * Identifier of the ICNS file, in ASCII "icns".
 * @type {Number}
 */
const FILE_HEADER_ID = 'icns';


/**
 * Information of the images, Mac OS 8.x (il32, is32, l8mk, s8mk) is unsupported.
 * If icp4, icp5, icp6 is present, Icon will not be supported because it can not be set as Folder of Finder.
 */
const ICON_INFOS: IconInfo[] = [
	// Normal
	{type: 'ic07', size: 128},
	{type: 'ic08', size: 256},
	{type: 'ic09', size: 512},
	{type: 'ic10', size: 1024},

	// Retina
	{type: 'ic11', size: 32},
	{type: 'ic12', size: 64},
	{type: 'ic13', size: 256},
	{type: 'ic14', size: 512},

	// Mac OS 8.5
	{type: 'is32', mask: 's8mk', size: 16},
	{type: 'il32', mask: 'l8mk', size: 32},
];

/**
 * Select the support image from the icon size.
 * @param size Size of icon.
 * @param images File information.
 * @return If successful image information, otherwise null.
 */
const imageFromIconSize = (size: number, images: Image[]): Image | null => {
	for (const image of images) {
		if (image.size === size) {
			return image;
		}
	}

	return null;
};

/**
 * Create the ICNS file header.
 * @param fileSize File size.
 * @return Header data.
 */
const createFileHeader = (fileSize: number): Buffer => {
	const buffer = Buffer.alloc(HEADER_SIZE);
	buffer.write(FILE_HEADER_ID, 0, 'ascii');
	buffer.writeUInt32BE(fileSize, 4);

	return buffer;
};

/**
 * Create the Icon header in ICNS file.
 * @param type Type of the icon.
 * @param imageSize Size of the image data.
 * @return Header data.
 */
const createIconHeader = (type: string, imageSize: number): Buffer => {
	const buffer = Buffer.alloc(HEADER_SIZE);
	buffer.write(type, 0, 'ascii');
	buffer.writeUInt32BE(HEADER_SIZE + imageSize, 4);

	return buffer;
};

/**
 * Create a color and mask data.
 * @param image Binary of image file.
 * @return Pack bit bodies.
 */
const createIconBlockPackBitsBodies = (image: Buffer): PackBitBody => {
	const png = PNG.sync.read(image);
	const results: PackBitBody = {colors: [], masks: []};
	const r = [];
	const g = [];
	const b = [];

	for (let i = 0, max = png.data.length; i < max; i += 4) {
		// RGB
		r.push(png.data.readUInt8(i));
		g.push(png.data.readUInt8(i + 1));
		b.push(png.data.readUInt8(i + 2));

		// Alpha
		results.masks.push(png.data.readUInt8(i + 3));
	}

	// Compress
	results.colors = results.colors.concat(packICNS(r));
	results.colors = results.colors.concat(packICNS(g));
	results.colors = results.colors.concat(packICNS(b));

	return results;
};

/**
 * Create an icon block's data.
 * @param type Type of the icon.
 * @param image Binary of image file.
 * @return Binary of icon block.
 */
const createIconBlockData = (type: string, image: Buffer): Buffer => {
	const header = createIconHeader(type, image.length);
	return Buffer.concat([header, image], header.length + image.length);
};

/**
 * Create an icon blocks (Color and mask) for PackBits.
 * @param type Type of the icon in color block.
 * @param mask Type of the icon in mask block.
 * @param image Binary of image file.
 * @return Binary of icon block.
 */
const createIconBlockPackBits = (type: string, mask: string, image: Buffer): Buffer => {
	const bodies = createIconBlockPackBitsBodies(image);
	const colorBlock = createIconBlockData(type, Buffer.from(bodies.colors));
	const maskBlock = createIconBlockData(mask, Buffer.from(bodies.masks));

	return Buffer.concat([colorBlock, maskBlock], colorBlock.length + maskBlock.length);
};

/**
 * Create an icon block.
 * @param info Icon information in ICNS.
 * @param filePath Path of image (PNG) file.
 * @return Binary of icon block.
 */
const createIconBlock = async (info: IconInfo, image: Buffer): Promise<Buffer> => {
	switch (info.type) {
		case 'is32':
		case 'il32':
			return createIconBlockPackBits(info.type, info.mask || '', image);

		default:
			return createIconBlockData(info.type, image);
	}
};

/**
 * Create the ICNS file body on memory buffer.
 * @param images Information of the image files.
 * @returns Body of ICNS file.
 */
const createFileBody = async (images: Image[]): Promise<Buffer> => {
	let body = Buffer.alloc(0);
	for (const info of ICON_INFOS) {
		const image = imageFromIconSize(info.size, images);

		if (!image) continue;

		const block = await createIconBlock(info, image.buffer);
		body = Buffer.concat([body, block], body.length + block.length);
	}

	return body;
};

/**
 * Create an ICNS file.
 * @param images Information of the image files.
 * @param filePath The path of the output destination file.
 * @return Asynchronous task.
 */
export const createIcns = async (images: Image[]): Promise<Buffer> => {
	// Write images on memory buffer
	const body = await createFileBody(images);

	if (body.length === 0) {
		throw new Error('Failed to create the body of the file. The size is `0`.');
	}

	return Buffer.concat([createFileHeader(body.length + HEADER_SIZE), body]);
};
