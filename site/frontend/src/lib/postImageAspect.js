/** Ratio et dimensions unifiés pour les photos de publication (portrait 4:5). */

export const POST_IMAGE_RATIO = 4 / 5;
export const POST_IMAGE_ASPECT_CLASS = 'aspect-[4/5]';
export const POST_OUTPUT_WIDTH = 1024;
export const POST_OUTPUT_HEIGHT = 1280;
export const POST_VIEWPORT_WIDTH = 320;
export const POST_VIEWPORT_HEIGHT = Math.round(POST_VIEWPORT_WIDTH / POST_IMAGE_RATIO);
