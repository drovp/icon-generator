import {promises as FSP} from 'fs';
import * as Path from 'path';
import type {ProcessorUtils} from '@drovp/types';
import type {Payload} from './';
// import * as Jimp from 'jimp';
import {createIco} from './lib/ico';
import {createIcns} from './lib/icns';
import {InputImage, Image} from './types';
import * as initSharp from 'sharp';

// Unptyped
// const Svg2 = require('oslllo-svg2');
const pngquant = require('imagemin-pngquant');
const nativeImport = ((name: string) => eval(`import('${name}')`)) as (name: string) => Promise<any>;

type OutputImages = Record<string, Image>;

/**
 * Required because of https://github.com/lovell/sharp/pull/2787
 */
async function resizedSvgToSharp(svg: string | Buffer, {width, height}: {width?: number; height?: number}) {
	const instance = initSharp(svg);

	const metadata = await instance.metadata();

	const initDensity = metadata.density ?? 72;

	if (metadata.format !== 'svg') {
		return instance;
	}

	let wDensity = 0;
	let hDensity = 0;
	if (width && metadata.width) {
		wDensity = (initDensity * width) / metadata.width;
	}

	if (height && metadata.height) {
		hDensity = (initDensity * height) / metadata.height;
	}

	if (!wDensity && !hDensity) {
		// both width & height are not present and/or
		// can't detect both metadata.width & metadata.height
		return instance;
	}

	return initSharp(svg, {density: Math.max(wDensity, hDensity)}).resize(width, height);
}

function extractSvgSize(path: string) {
	const filename = Path.basename(path.toLowerCase(), '.svg');
	const match = /^(.+\-)?((?<size>\d+)(x\d+)?)$/.exec(filename);
	return match ? parseInt(match.groups?.size || '', 10) || Infinity : Infinity;
}

function extractName(path: string) {
	const filename = Path.basename(path, Path.extname(path));
	const parts = filename.split('-');
	const lastPartIsSize = parts[parts.length - 1]!.match(/^\d+(x\d+)?$/) != null;
	return (lastPartIsSize ? parts.slice(0, -1) : parts).join('-');
}

function pluckValues<T>(map: Record<string | number, T>, keys: (string | number)[]): T[] {
	const result: T[] = [];

	for (const size of keys) {
		const buffer = map[size];
		if (!buffer) throw new Error(`Output size ${size} is missing`);
		result.push(buffer);
	}

	return result;
}

export default async ({options, items, item}: Payload, {stage, progress, output}: ProcessorUtils) => {
	const neededSizes = [
		...new Set([
			...(options.ico.enabled ? options.ico.sizes : []),
			...(options.icns.enabled ? options.icns.sizes : []),
			...(options.favicon.enabled ? options.favicon.sizes : []),
			...(options.faviconPngs.enabled ? options.faviconPngs.sizes : []),
		]),
	];
	const inputImages: InputImage[] = [];
	const outputImages: OutputImages = {};
	const inputDirectory = Path.dirname(item.path);
	const inputName = extractName(item.path);
	const outputDirectory = Path.resolve(inputDirectory, options.destination);
	const imagemin = (await nativeImport('imagemin')).default; // man, this sucks
	const optimizer = options.pngquant.enabled
		? pngquant({
				speed: options.pngquant.speed,
				maxQuality: options.pngquant.maxQuality,
				dithering: options.pngquant.dithering,
				strip: true,
		  })
		: false;

	// Calculate progress steps
	progress.completed = 0;
	progress.total =
		1 + // Serializing input images
		neededSizes.length + // Generating sizes
		(options.ico.enabled ? 1 : 0) + // Generating ico
		(options.icns.enabled ? 1 : 0) + // Generating icns
		(options.favicon.enabled ? 1 : 0) + // Generating favicon
		(options.faviconPngs.enabled ? 1 : 0); // Saving favicon pngs

	stage('serializing images');

	for (const item of items) {
		const isSvg = item.type === 'svg';
		let buffer = await FSP.readFile(item.path);

		// Convert to PNG
		if (isSvg) {
			console.log(`converting svg to png`);
			console.log('resizedSvgToSharp');
			buffer = await (await resizedSvgToSharp(buffer, {width: 1024, height: 1024})).png().toBuffer();
		}

		const sharp = await initSharp(buffer);
		const size = isSvg ? extractSvgSize(item.path) : (await sharp.metadata()).width;

		if (typeof size !== 'number') throw new Error(`Couldn't extract image size of: ${item.path}`);

		inputImages.push({size, sharp});
	}

	// Sort by size, ascending
	inputImages.sort((a, b) => (a.size > b.size ? -1 : a.size < b.size ? 1 : 0));

	progress.completed += 1;

	/**
	 * Generate output images that will be needed in subsequent operations.
	 */
	stage('generating missing sizes');

	for (const size of neededSizes) {
		let source = inputImages.find((input) => input.size >= size) || inputImages[inputImages.length - 1];
		if (!source) throw new Error(`No source found for size ${size}x${size}.`);

		let sharp = source.sharp;

		// Resize
		if (size !== source.size) {
			console.log(`resizing from ${source.size} to ${size}`);
			sharp = sharp.clone().resize(size, size);
		}

		let buffer = await sharp.png().toBuffer();

		// Optimize
		if (optimizer) {
			console.log('optimizing');
			buffer = await imagemin.buffer(buffer, {plugins: [optimizer]});
		}

		outputImages[size] = {size, buffer};
		progress.completed += 1;
	}

	await FSP.mkdir(outputDirectory, {recursive: true});

	/**
	 * ICO output.
	 */
	if (options.ico.enabled) {
		stage('creating ico');

		if (options.ico.sizes.length === 0) throw new Error(`No sizes selected for ico output.`);

		const images = pluckValues(outputImages, options.ico.sizes);
		const icoBuffer = await createIco(images);
		const outputPath = Path.join(outputDirectory, `${options.ico.name.trim() || inputName}.ico`);

		console.log(`saving to: ${outputPath}`);
		await FSP.writeFile(outputPath, icoBuffer);
		output.file(outputPath);
		progress.completed += 1;
	}

	/**
	 * ICNS output.
	 */
	if (options.icns.enabled) {
		stage('creating icns');

		if (options.icns.sizes.length === 0) throw new Error(`No sizes selected for icns output.`);

		const images = pluckValues(outputImages, options.icns.sizes);
		console.log(images.map((image) => image.size).join(', '));
		const icoBuffer = await createIcns(images);
		const outputPath = Path.join(outputDirectory, `${options.icns.name.trim() || inputName}.icns`);

		console.log(`saving to: ${outputPath}`);
		await FSP.writeFile(outputPath, icoBuffer);
		output.file(outputPath);
		progress.completed += 1;
	}

	/**
	 * Favicon output.
	 */
	if (options.favicon.enabled) {
		stage('creating favicon');

		if (options.favicon.sizes.length === 0) throw new Error(`No sizes selected for ico output.`);

		const buffers = pluckValues(outputImages, options.favicon.sizes);
		const icoBuffer = await createIco(buffers);
		const outputPath = Path.join(outputDirectory, `${options.favicon.name.trim() || inputName}.ico`);

		console.log(`saving to: ${outputPath}`);
		await FSP.writeFile(outputPath, icoBuffer);
		output.file(outputPath);
		progress.completed += 1;
	}

	/**
	 * Favicon PNGS output.
	 */
	if (options.faviconPngs.enabled) {
		stage('creating favicon pngs');

		for (const size of options.faviconPngs.sizes) {
			console.log(size);
			const image = outputImages[size];

			if (!image) throw new Error(`Missing output size ${size}.`);

			const outputPath = Path.join(
				outputDirectory,
				`${options.faviconPngs.name.trim() || inputName}-${size}x${size}.png`
			);
			console.log(`saving to: ${outputPath}`);
			await FSP.writeFile(outputPath, image.buffer);
			output.file(outputPath);
		}

		progress.completed += 1;
	}
};
