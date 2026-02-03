# What will it take to train?

This is the question floppybird seeks to answer.

Given a compute budget (FLOPs), specified directly or through some combinaton of tokens-trained-on + model architecture, calculate how many accelerators (of many types) are needed for how long. floppybird takes into account MFUs by architecture, chip interconnect scaling discount factors, and accelerator architecture. It also can calculate prices.


# Project spec:

At the core, floppybird is a single page that
1. let you specify a given model
2. shows you the number of accelerators needed for how long to train it

## archtecture and overall considerations

It's got keyboard shortcuts for lots of things. localstorage is used to save (automatically) all the data in a given sheet. if you refresh the page, the data is still there in the cells it was before you refreshed.

For now, 1 HTML page, 1 css, 1 JS (react.js).

## style
I want this to be reminiscent of a tufte-style document. Nice font. Minimal ink. Off-white background.

Supports dark model based on system settings. 


## the app is strutured like this

### Menubar
TOP: menubar with config, and a "saved calcs" button (kbd=s, nav with j/k and enter to select and close model, esc to close modal), and a "new calc" (shift+=) button that saves the current calc and refreshed the fields on the page.


### model spec
 text field to name the model (and show it's saved) (kbd=n to jump to it). If blank it gets named by the choice below i.e. MoE 8B active 7T tokens, or 3.5 x 10^24 FLOPs for a FLOP model.

Below that the model specifider stuff described below. Jump to it with kbd=m (which focuses the dropdown, and you can tab through the other fields of course).

3 choices of calculator are possible, far left side dropdown of MoE (default), dense, and FLOP.
- MoE: asks for active params per token, number of experts, total tokens (calc is 6 * P * T)
- dense: asks for total params, total tokens (calculation is 6 * P * T)
- FLOP: just asks for the total model FLOPs (i.e. the person calculator this some other way)

describe the calculation being used for MoE and Dense in smaller greyer text below.

Right below these is a prominent calculated field that shows model FLOPs in scientific notation (i.e. 5.45 x 10^26). This is just equal to the flops specified in the FLOP calculator. if it's 10^28 or above, add a scared emoji to the right, and if it's 10^22 or lower, add a thinking emoji to the right.

### the calculation table

Supported accelerators:
- A, H, B series NVDIA chips
- v4p, v5e, v5p, v6e, and other TPUs from Google

It defaults to showing A100s, v4p, v5p, v6e.

There's a table with a row for each accelerator, and then columns. If the column has a * in front of the name, then we make this user-editable (even if it has default data in it). If it has default data in it, you can press a tiny little reset logo next to that particular to reset it to the default value (which is in a lighter grey color, but still editable). Each column header has a little i in a circle that you can hover for more info about what the column is. Use your best judgement for columns

- accelerator: the accelerator names above
- F16 FLOP/s: each accelerator has a FLOP/sec for bf16 and f16, and we use bf16 by default (and it displayed this number).   v6e = 9.18e14, v5p = 4.59e14, v5e = 1.97e14, v4p = 2.75e14, b200 = 1.23e12, and make up the others for now. 
- chip/pod: # of chips per pod. v6e = 256, v5p = 8960, v5e = 256, v4p = 4096
- *MFU: we assume MFUs by various accelerators by default, but it's editable. v6e = 0.35, v5p = 0.6, v5e = 0.6, v4p = 0.5, all NVDIA chips = 0.35
- *log2 scaling factor: We penalize the FLOP contribution by the factor in D1 for every doubling of pods needed. This is the factor (which can't be above 1—we don't get a bonus for using a fraction of a pod). For GPUs, we use a .9 factor for every doubling of GPUs, not pods. (make sure this info is in the info hover). v6e = 0.7, v5p = 0.94, v5e = 0.7, v4p = 0.84, all NVDIA chips = 0.9.
- *$/hr: the cost of a single chip for one hour. default to $3.5 for all of them for now.

Then, on the right-hand side of the table we have calculated results:
- total hardware FLOPs needed (x.yzx10^x formatted)
- for each of these time periods (1 day, 1 week, 4 weeks, 8 weeks, + a configurable text field # of days)
  - number of chips needed (formatted with commas)
  - number of pods (for TPUs)


make a little copy icon on the top right of the table to copy it as a csv. 