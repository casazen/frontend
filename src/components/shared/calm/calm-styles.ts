/**
 * Classes that more than one calm block needs, in one place. They are plain strings and not `cn(...)` calls on purpose: a call
 * at the top of a module is not removed by tree shaking, and the blocks are imported through the barrel by code that uses
 * only one of them (the activation checklist uses only `NextStepCard`).
 */

/** At least 44 px high on every device (the product rule), and a long label wraps instead of pushing the page sideways. */
export const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** The look of a quiet action beside a title or under a list: the text in the accent of the area, no box. */
export const QUIET_ACTION = 'px-2 text-primary-text hover:text-primary-text';
