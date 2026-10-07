# Tulu Lipi font

The **Tulu Lipi** section of the Learn page renders real Unicode characters from
the Tulu-Tigalari block (U+11380–U+113FF, added in Unicode 16.0).

No operating system ships a font covering this block, and at the time of
writing none is published on Google Fonts, npm or Fontsource. Without a font
the browser draws empty boxes, so the app detects the missing font and shows
the Kannada counterpart plus an explanation instead.

## To show the real letterforms

Put a Tulu-Tigalari font in this folder as either:

    public/fonts/TuluTigalari.woff2      (preferred — smaller)
    public/fonts/TuluTigalari.ttf

and reload. Nothing else needs changing: `src/styles/global.css` already
declares the `@font-face` rule that looks here, and the page re-checks on load.

A font already installed on the viewer's machine is used first, if its family
name is one of: `Noto Sans Tulu Tigalari`, `Noto Serif Tulu Tigalari`,
`Tulu Tigalari`, or `Tigalari`. Add other names to the `local()` list in
`global.css` if your font uses a different one.

## Converting a TTF to WOFF2

    pip install fonttools brotli
    python -c "from fontTools.ttLib import TTFont; f=TTFont('TuluTigalari.ttf'); f.flavor='woff2'; f.save('TuluTigalari.woff2')"

## Licensing

Check the font's licence before committing it. Open-licensed fonts (SIL OFL,
Apache) can be redistributed with the project; keep the licence file beside the
font.
