/**
 * The owner login block: a link, never a frame. It is dynamic: PHP prints the front end, so nothing is saved in the content of
 * the post.
 */
import { registerBlockType } from '@wordpress/blocks';

import metadata from './block.json';
import { createEdit } from '../shared/placeholder-edit';

registerBlockType( metadata.name, {
	edit: createEdit( metadata ),
	save: () => null,
} );
