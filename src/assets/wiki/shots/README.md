# Screenshots

Drop a PNG or JPG in here named after the page it belongs to and it appears
automatically. No code changes, no config.

    <node-id>.png     ->  shows on that node's panel in the map
    <step-id>.png     ->  shows as the header image for that guide step

Node ids are the `id` field in `solo-leveling-reawakening.json`; step ids are
in `solo-leveling-reawakening.guide.json` (they all start with `step-`).

Examples:

    the-system.png            System panel
    shadow-extraction.png     Arise
    cartenon-temple.png       Cartenon Temple
    step-first-gates.png      guide step 3 header

Images are resized and converted to WebP at build time, so commit the
original quality file. 1920x1080 is ideal; anything wider is fine.
