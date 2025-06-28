import { Size, Rect } from './Utilities';
import * as fs from 'fs';
import * as toml from 'toml';
import IConfig from './IConfig';
import * as cvm from '@cvmts/cvm-rs';

let Config: IConfig;
var configRaw = fs.readFileSync('config.toml').toString();
Config = toml.parse(configRaw);

let gJpegQuality = Config.collabvm.screenQuality ?? 30;

const kThumbnailSize: Size = {
	width: 400, // ? multiply here
	height: 300 // ? divide here
};

export class FrameEncoder {
	static SetQuality(quality: number) {
		gJpegQuality = quality;
	}

	static async Encode(canvas: Buffer, displaySize: Size, rect: Rect): Promise<Buffer> {
		let offset = (rect.y * displaySize.width + rect.x) * 4;
		return cvm.jpegEncode({
			width: rect.width,
			height: rect.height,
			stride: displaySize.width,
			buffer: canvas.subarray(offset),
			quality: gJpegQuality
		});
	}

	static async EncodeThumbnail(buffer: Buffer, size: Size): Promise<Buffer> {
		return cvm.jpegResizeEncode({
			width: size.width,
			height: size.height,
			desiredWidth: kThumbnailSize.width,
			desiredHeight: kThumbnailSize.height,
			buffer: buffer,
			quality: 75 // btw its a thumbnail ig
		});
	}
}
