import * as Path from 'path';
import {Plugin, PayloadData, OptionsSchema, makeAcceptsFlags} from '@drovp/types';

export type FontType = 'ttf' | 'woff' | 'woff2' | 'eot' | 'svg';
type Options = {
	ask: boolean;
	destination: string;
	ico: {
		enabled: boolean;
		name: string;
		sizes: number[];
	};
	icns: {
		enabled: boolean;
		name: string;
		sizes: number[];
	};
	favicon: {
		enabled: boolean;
		name: string;
		sizes: number[];
	};
	faviconPngs: {
		enabled: boolean;
		name: string;
		sizes: number[];
	};
	pngquant: {
		enabled: boolean;
		speed: number;
		maxQuality: number;
		dithering: number;
	};
};

const iconSizes = [16, 20, 24, 32, 40, 48, 57, 64, 72, 96, 120, 128, 144, 152, 195, 228, 256, 512, 1024];
const optionsSchema: OptionsSchema<Options> = [
	{
		name: 'ask',
		type: 'boolean',
		default: false,
		title: 'Ask for destination',
		description: `Always ask for destination. Also available as a <kbd>ctrl</kbd> drop modifier key.`,
	},
	{
		name: 'destination',
		type: 'path',
		kind: 'directory',
		title: 'Destination',
		description: `Destination directory to save generated files to. Relative path starts at the input file's directory. Lave empty to save in the same directory as input file.`,
		isHidden: (_, {ask}) => ask,
	},
	{
		name: 'ico',
		type: 'namespace',
		title: 'ICO',
		description: 'An <code>.ico</code> file intended for windows app icons, etc.',
		schema: [
			{
				name: 'enabled',
				type: 'boolean',
				default: false,
				title: 'Enabled',
			},
			{
				name: 'name',
				type: 'string',
				title: 'Name',
				description: `Name of the output file without the extension. Leave empty to inherit the name of the input file.`,
				isHidden: (_, {ico}) => !ico.enabled,
			},
			{
				name: 'sizes',
				type: 'select',
				options: iconSizes,
				default: [16, 20, 24, 32, 40, 48, 64, 128, 256],
				title: 'Sizes',
				description: `What sizes to generate and include in the <code>.ico</code> file.`,
				isHidden: (_, {ico}) => !ico.enabled,
			},
		],
	},
	{
		name: 'icns',
		type: 'namespace',
		title: 'ICNS',
		description: 'An <code>.icns</code> file for apple ecosystem.',
		schema: [
			{
				name: 'enabled',
				type: 'boolean',
				default: false,
				title: 'Enabled',
			},
			{
				name: 'name',
				type: 'string',
				title: 'Name',
				description: `Name of the output file without the extension. Leave empty to inherit the name of the input file.`,
				isHidden: (_, {icns}) => !icns.enabled,
			},
			{
				name: 'sizes',
				type: 'select',
				options: iconSizes,
				default: [16, 32, 64, 128, 256, 512, 1024],
				title: 'Sizes',
				description: `What sizes to generate and include in the <code>.icns</code> file.`,
				isHidden: (_, {icns}) => !icns.enabled,
			},
		],
	},
	{
		name: 'favicon',
		type: 'namespace',
		title: 'Favicon',
		description: 'A <code>favicon.ico</code> file for websites.',
		schema: [
			{
				name: 'enabled',
				type: 'boolean',
				default: false,
				title: 'Enabled',
			},
			{
				name: 'name',
				type: 'string',
				default: 'favicon',
				title: 'Name',
				description: `Name of the output file without the extension. Leave empty to inherit the name of the input file.`,
				isHidden: (_, {favicon}) => !favicon.enabled,
			},
			{
				name: 'sizes',
				type: 'select',
				options: iconSizes,
				default: [16, 32, 48],
				title: 'Sizes',
				description: `What sizes to generate and include in the <code>favicon.ico</code> file.`,
				isHidden: (_, {favicon}) => !favicon.enabled,
			},
		],
	},
	{
		name: 'faviconPngs',
		type: 'namespace',
		title: 'PNG favicons',
		description:
			'<code>favicon-{size}x{size}.png</code> files used in a lot of places (see <a href="https://github.com/audreyfeldroy/favicon-cheat-sheet">cheat sheet</a>).',
		schema: [
			{
				name: 'enabled',
				type: 'boolean',
				default: false,
				title: 'Enabled',
			},
			{
				name: 'name',
				type: 'string',
				default: 'favicon',
				title: 'Name',
				description: `Name of the output file without the extension. Leave empty to inherit the name of the input file.`,
				isHidden: (_, {faviconPngs}) => !faviconPngs.enabled,
			},
			{
				name: 'sizes',
				type: 'select',
				options: iconSizes,
				default: [32, 57, 72, 96, 120, 128, 144, 152, 195, 228],
				title: 'Sizes',
				description: `What PNG sizes to generate.`,
				isHidden: (_, {faviconPngs}) => !faviconPngs.enabled,
			},
		],
	},
	{
		name: 'pngquant',
		type: 'namespace',
		title: 'PNGQuant optimization',
		schema: [
			{
				name: 'enabled',
				type: 'boolean',
				default: true,
				title: 'Enabled',
			},
			{
				name: 'speed',
				type: 'number',
				min: 1,
				max: 11,
				step: 1,
				default: 4,
				title: 'Speed',
				description: `<code>1</code> (slowest) to <code>11</code> (fastest).<br>
						Speed <code>10</code> has 5% lower quality, but is about 8 times faster than the default.<br>
						Speed <code>11</code> disables dithering and lowers compression level.`,
				isHidden: (_, {pngquant}) => !pngquant.enabled,
			},
			{
				name: 'maxQuality',
				type: 'number',
				min: 0.1,
				max: 1,
				step: 0.1,
				default: 0.8,
				title: 'Max quality',
				description: `Instructs pngquant to use the least amount of colors required to meet or exceed the max quality.<br>
						<code>0</code> (worst) to <code>1</code> (perfect).`,
				isHidden: (_, {pngquant}) => !pngquant.enabled,
			},
			{
				name: 'dithering',
				type: 'number',
				min: 0,
				max: 1,
				step: 0.1,
				default: 1,
				title: 'Dithering',
				description: `Set the dithering level using a fractional number between <code>0</code> (none) and <code>1</code> (full).`,
				isHidden: (_, {pngquant}) => !pngquant.enabled,
			},
		],
	},
];

const acceptsFlags = makeAcceptsFlags<Options>()({
	files: ['svg', 'png'],
});

export type Payload = PayloadData<Options, typeof acceptsFlags>;

export default (plugin: Plugin) => {
	plugin.registerProcessor<Payload>('icon-generator', {
		main: 'dist/processor.js',
		description: 'Generate .ico, .icns, or .png icons out of one or multiple png or svg files.',
		accepts: acceptsFlags,
		threadType: 'cpu',
		bulk: true,
		options: optionsSchema,
		operationPreparator: async (payload, utils) => {
			if (payload.options.ask || utils.modifiers === (process.platform === 'darwin' ? 'Alt' : 'Ctrl')) {
				const result = await utils.showOpenDialog({
					title: `Destination directory`,
					defaultPath: Path.dirname(payload.input.path),
					properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
				});

				// Cancel operation
				if (result.canceled) return false;

				const dirname = result.filePaths[0];

				if (typeof dirname === 'string') {
					payload.options.destination = dirname;
				} else {
					throw new Error(`invalid destination folder path ${dirname}`);
				}
			}

			return payload;
		},
		modifierDescriptions: {
			Ctrl: `ask for destination folder (overwrites the option)`,
		},
	});
};
