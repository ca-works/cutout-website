# Demonstration image sources

Every cutout on the website is CutOut's own, unretouched output. Each sample here is the original
photograph plus the alpha matte CutOut's engine produced for it.

| File | Photograph | Author | Licence | Source |
|---|---|---|---|---|
| `cat.jpg` | Young Tabby Cat Portrait (2810 × 2810) | TudorTulok | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Young_Tabby_Cat_Portrait.jpg |
| `mug.jpg` | Mug vs cup (1993 × 1244) | Викидим | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Mug_vs_cup.jpg |
| `dandelion.jpg` | Seed head of a dandelion, specifically Taraxacum officinale (1440 × 1800) | Adesolive | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Seed_head_of_a_dandelion,_specifically_Taraxacum_officinale.jpg |

Licences were read from the Wikimedia Commons file pages (API `extmetadata`) on 4 November 2026.
The photographs are the same files the application's benchmark uses (`bench/images.tsv` in the
application repository).

## How the mattes were made

`*-matte.png` is the alpha channel of:

```bash
cutout-cli remove ~/Library/Application\ Support/CutOut/Models/birefnet-general-fp32.onnx <photo>.jpg out.png cpu
```

run on 4 November 2026 with the CutOut 0.1 engine (application commit `907c359`, branch
`dev/v0.1`): BiRefNet general (MIT), ONNX Runtime on the CPU, default edge refinement. That is the
same model and refinement as the app's Best Quality mode, which runs it through Core ML instead.
Nothing was edited by hand.

## Licence of derived images

The cat cutout, its mask and the hero textures are adaptations of a CC BY-SA 4.0 work and are
shared under CC BY-SA 4.0, credited on the site (Guide ▸ Credits and next to each image). The CC0
images and their cutouts carry no restrictions.

SHA-256 of the committed files:

```
c88bff48b28b1869a470ca2a3ce9a51a802d027743a4a9927b2e6c983cd98c28  cat.jpg
1b57034215647f9c18c2a2dd9c2b47ef3b87a7dd33960e66f3002cbc385e10bb  cat-matte.png
eff221eec14528289819bded0eecdfdb489285dc7fdcfea7cf9cf739c882fae5  mug.jpg
d3e0ab8be226b737df4000ae5782560dffbd72eed754dca1dd836597d85dfefd  mug-matte.png
bb04910fd7652d3aa11d38cd7b73e4e1cc57e35b72af84774293e09b07652566  dandelion.jpg
f326a6cdc9b307f74e1c868a3538f799da69eb8e05ff656f2c23f8bec3fb101f  dandelion-matte.png
```
