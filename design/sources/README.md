# Demonstration image sources

Every cutout on the website is CutOut's own, unretouched output. Each sample here is the original
photograph plus the alpha matte CutOut's engine produced for it.

| File | Photograph | Author | Licence | Source |
|---|---|---|---|---|
| `mug.jpg` | Enamel mug (1974 × 1974) — the home page's title image | knoe | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Enamel_mug.jpg |
| `crankset.jpg` | Crank Set (1803 × 1788) | Romantiker | CC BY-SA 3.0 (relicensed from GFDL) | https://commons.wikimedia.org/wiki/File:Crank_Set.jpg |
| `golden.jpg` | Golden Retriever Puppy in the House (2641 × 1935) | SapphireDreamPhotography | CC BY 3.0 | https://commons.wikimedia.org/wiki/File:Golden_Retriever_Puppy_in_the_House.JPG |
| `bolt.jpg` | Hex head bolt (rendered by Commons from the 2070 px TIFF at 1920 px) | Susan Wright | Public domain | https://commons.wikimedia.org/wiki/File:Hex_head_bolt.tif |
| `bolts.jpg` | Sechskantschrauben -- 2020 -- 3985-8 (stored at 2400 px) | Dietmar Rabich | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Sechskantschrauben_--_2020_--_3985-8.jpg |
| `dandelion.jpg` | Seed head of a dandelion, specifically Taraxacum officinale (1440 × 1800) | Adesolive | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Seed_head_of_a_dandelion,_specifically_Taraxacum_officinale.jpg |

Licences and authors were read from the Wikimedia Commons file pages (API `extmetadata`, and the
page text where the author field is empty) on 4 November 2026. `golden.jpg` and `mug.jpg` were
replaced later that day at the owner's request (the earlier puppy stood in grass that hid part of
a hind leg; the title image changed from the crankset to a mug). All stored files are re-encoded
without metadata (no EXIF/GPS).

## How the mattes were made

`*-matte.png` is the alpha channel of:

```bash
cutout-cli remove ~/Library/Application\ Support/CutOut/Models/birefnet-general-fp32.onnx <photo>.jpg out.png cpu
```

run on 4 November 2026 with the CutOut 0.1 engine (application commit `907c359`, branch
`dev/v0.1`): BiRefNet general (MIT), ONNX Runtime on the CPU, default edge refinement — the same
model and refinement as the app's Best Quality mode, which runs it through Core ML instead. The
engine ran on the full-size downloads; where a photo is stored smaller, its matte was resized with
it. Nothing was edited by hand.

## App screenshots

`src/assets/screens/app-*.png` are the app's own self-test renders (`CUTOUT_SELFTEST`, dark
appearance) with `golden.jpg` as the sample photo, supplied through `CUTOUT_SELFTEST_BENCH` (no
application code was changed). The renders have an empty strip where the toolbar is (the display
was locked, so only the layer tree could be rendered); that strip is cropped off, nothing else.

## Licence of derived images

Cutouts, masks, shadows and the traced outline are adaptations. Those made from CC BY-SA works are
shared under the same licence; all are credited on the site (Guide ▸ Credits and next to each
image).
