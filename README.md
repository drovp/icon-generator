# @drovp/icon-generator

Generate .ico, .icns, or .png icons out of one or multiple png or svg files.

Supports dropping multiple files of different sizes. Processor will then generate the missing sizes from the closest bigger input file.

For example, if you drop in two png files 32x32 and 1024x1024 pixels big, they'll be used as sources like so:

| Size | Dropped files | Size source |
| ---- | ------------- | ----------- |
| 1024 | 1024.png      | 1024.png    |
| 512  | x             | 1024.png    |
| 256  | x             | 1024.png    |
| 128  | x             | 1024.png    |
| 64   | x             | 1024.png    |
| 32   | 32.png        | 32.png      |
| 16   | x             | 32.png      |

#### PNG

When dropping png files, the file should be of square dimensions, and at least 1024x1024 pixels big, or whatever is the max needed size in one of the generated icon files.

#### SVG

If you are dropping svg files, their intended size is determined by their file name. To specify svg file as being 32px big, its name needs to be in one of these formats:

- `32.svg`
- `32x32.svg`
- `foo-32.svg`
- `foo-32x32.svg`

Dropped SVG file without recognizable filename size is considered to be of infinite size.

### Help

If you're generating favicons for browsers, this cheat sheet might be helpful: https://github.com/audreyfeldroy/favicon-cheat-sheet
