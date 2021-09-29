import type * as Jimp from 'jimp';
import type * as sharp from 'sharp';

type PromiseValue<PromiseType> = PromiseType extends PromiseLike<infer Value> ? PromiseValue<Value> : PromiseType;

export type JimpImage = PromiseValue<ReturnType<typeof Jimp.read>>;

export interface InputImage {
	size: number;
	sharp: sharp.Sharp;
}

export interface Image {
	size: number;
	buffer: Buffer;
}
