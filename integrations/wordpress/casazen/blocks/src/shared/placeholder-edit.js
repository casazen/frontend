/**
 * The editor side of every CasaZen block.
 *
 * It draws a placeholder that names the widget and lists what was chosen, and a panel of controls in the sidebar, one per
 * attribute of the block. The widget itself is printed by PHP on the published page: nothing here renders it (no
 * ServerSideRender) and nothing here calls the network.
 *
 * The controls are found by the NAME of the attribute, so a block shows exactly the attributes its `block.json` declares. The
 * names and types are the ones of the shortcode (see `Renderer::attribute_map()` in PHP).
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { PanelBody, Placeholder, SelectControl, TextControl, ToggleControl } from '@wordpress/components';

/**
 * The attributes that are about the look of the widget; the others are about what it does.
 */
const APPEARANCE = [ 'primary', 'radius', 'font' ];

/**
 * The control of each attribute. A function, not a constant: the texts are translated when the editor draws them, after the
 * translations of the script have been loaded.
 *
 * @return {Object} The controls by attribute name: `kind` (text, number, select or toggle), `label`, `help`, `options`.
 */
function getFields() {
	return {
		lang: {
			kind: 'select',
			label: __( 'Language', 'casazen' ),
			help: __(
				'The default follows the language of the page and the language mapping of the plugin settings.',
				'casazen'
			),
			options: [
				{ value: '', label: __( 'Default', 'casazen' ) },
				{ value: 'it', label: __( 'Italian', 'casazen' ) },
				{ value: 'en', label: __( 'English', 'casazen' ) },
				{
					value: 'auto',
					label: __( 'Automatic (read from the page by the browser)', 'casazen' ),
				},
			],
		},
		slug: {
			kind: 'text',
			label: __( 'Property slug', 'casazen' ),
			help: __(
				'The last part of the address of the property on your CasaZen site, for example villa-rossa.',
				'casazen'
			),
		},
		checkin: {
			kind: 'text',
			label: __( 'Check-in date', 'casazen' ),
			help: __( 'Written as YYYY-MM-DD. Leave empty to let the guest choose.', 'casazen' ),
		},
		checkout: {
			kind: 'text',
			label: __( 'Check-out date', 'casazen' ),
			help: __( 'Written as YYYY-MM-DD. Leave empty to let the guest choose.', 'casazen' ),
		},
		guests: {
			kind: 'number',
			label: __( 'Guests', 'casazen' ),
			help: __( 'A number from 1 to 30. Leave empty to let the guest choose.', 'casazen' ),
			min: 1,
			max: 30,
		},
		target: {
			kind: 'text',
			label: __( 'Booking page', 'casazen' ),
			help: __(
				'Where the search leads: a path of this site, an address of this site or an https address. Leave empty to use the page that holds the booking engine.',
				'casazen'
			),
		},
		destinations: {
			kind: 'select',
			label: __( 'Places', 'casazen' ),
			help: __( 'Offers the places of your properties in the search bar.', 'casazen' ),
			options: [
				{ value: 'yes', label: __( 'Yes', 'casazen' ) },
				{ value: 'no', label: __( 'No', 'casazen' ) },
			],
		},
		max_guests: {
			kind: 'number',
			label: __( 'Most guests', 'casazen' ),
			help: __( 'The most guests the search bar accepts, from 1 to 99.', 'casazen' ),
			min: 1,
			max: 99,
		},
		datalayer: {
			kind: 'toggle',
			label: __( 'Send events to the data layer', 'casazen' ),
			help: __(
				'Reports searches, views and the start of a checkout to the data layer of the page (Google Tag Manager).',
				'casazen'
			),
		},
		sync_url: {
			kind: 'toggle',
			label: __( 'Keep the state in the address of the page', 'casazen' ),
			help: __(
				'Adds a cz parameter to the address of the page while the guest browses the widget.',
				'casazen'
			),
		},
		min_height: {
			kind: 'number',
			label: __( 'Initial height (pixels)', 'casazen' ),
			help: __(
				'A number from 100 to 2000. The widget then adapts its height to its content.',
				'casazen'
			),
			min: 100,
			max: 2000,
		},
		primary: {
			kind: 'text',
			label: __( 'Main colour', 'casazen' ),
			help: __( 'A colour written as #rgb or #rrggbb, for example #2b4c7e.', 'casazen' ),
		},
		radius: {
			kind: 'text',
			label: __( 'Corner radius', 'casazen' ),
			help: __( 'A whole number with px (up to 32px) or rem (up to 2rem), for example 8px.', 'casazen' ),
		},
		font: {
			kind: 'select',
			label: __( 'Font', 'casazen' ),
			help: __( 'One of the fonts of your CasaZen booking site.', 'casazen' ),
			options: [
				{ value: '', label: __( 'Default', 'casazen' ) },
				{ value: 'editoriale', label: __( 'Editorial', 'casazen' ) },
				{ value: 'moderno', label: __( 'Modern', 'casazen' ) },
				{ value: 'classico', label: __( 'Classic', 'casazen' ) },
			],
		},
		label: {
			kind: 'text',
			label: __( 'Text of the link', 'casazen' ),
			help: __( 'Leave empty to use the default text.', 'casazen' ),
		},
	};
}

/**
 * The value of an attribute as the placeholder shows it.
 *
 * @param {Object} field The control of the attribute.
 * @param {*}      value The value.
 * @return {string} A short text.
 */
function formatValue( field, value ) {
	if ( field.kind === 'toggle' ) {
		return value ? __( 'Yes', 'casazen' ) : __( 'No', 'casazen' );
	}
	if ( field.kind === 'select' ) {
		const option = field.options.find( ( item ) => item.value === value );
		return option ? option.label : String( value );
	}
	return String( value );
}

/**
 * One control of the sidebar.
 *
 * @param {Object}   props               The properties.
 * @param {string}   props.name          The name of the attribute.
 * @param {Object}   props.field         The control of the attribute.
 * @param {*}        props.value         The current value.
 * @param {Function} props.setAttributes The function of the block that changes attributes.
 * @return {Element} The control.
 */
function Field( { name, field, value, setAttributes } ) {
	const common = {
		label: field.label,
		help: field.help,
		__nextHasNoMarginBottom: true,
	};

	if ( field.kind === 'toggle' ) {
		return (
			<ToggleControl
				{ ...common }
				checked={ !! value }
				onChange={ ( checked ) => setAttributes( { [ name ]: checked } ) }
			/>
		);
	}
	if ( field.kind === 'select' ) {
		return (
			<SelectControl
				{ ...common }
				__next40pxDefaultSize
				value={ value ?? '' }
				options={ field.options }
				onChange={ ( chosen ) => setAttributes( { [ name ]: chosen } ) }
			/>
		);
	}
	if ( field.kind === 'number' ) {
		return (
			<TextControl
				{ ...common }
				__next40pxDefaultSize
				type="number"
				min={ field.min }
				max={ field.max }
				value={ value ?? '' }
				onChange={ ( typed ) => {
					const number = parseInt( typed, 10 );
					setAttributes( { [ name ]: Number.isNaN( number ) ? undefined : number } );
				} }
			/>
		);
	}
	return (
		<TextControl
			{ ...common }
			__next40pxDefaultSize
			value={ value ?? '' }
			onChange={ ( typed ) => setAttributes( { [ name ]: typed } ) }
		/>
	);
}

/**
 * Makes the `edit` function of a block.
 *
 * @param {Object} metadata The `block.json` of the block: its name, its title and its attributes.
 * @return {Function} The component of the editor.
 */
export function createEdit( metadata ) {
	const names = Object.keys( metadata.attributes );

	return function Edit( { attributes, setAttributes } ) {
		const blockProps = useBlockProps();
		const fields = getFields();
		const title = getBlockType( metadata.name )?.title ?? metadata.title;

		const known = names.filter( ( name ) => fields[ name ] );
		const settings = known.filter( ( name ) => ! APPEARANCE.includes( name ) );
		const appearance = known.filter( ( name ) => APPEARANCE.includes( name ) );

		// What the author chose: every value that is not the default of its attribute.
		const chosen = known.filter( ( name ) => {
			const value = attributes[ name ];
			return value !== undefined && value !== null && value !== metadata.attributes[ name ].default;
		} );

		const renderFields = ( list ) =>
			list.map( ( name ) => (
				<Field
					key={ name }
					name={ name }
					field={ fields[ name ] }
					value={ attributes[ name ] }
					setAttributes={ setAttributes }
				/>
			) );

		return (
			<>
				<InspectorControls>
					{ settings.length > 0 && (
						<PanelBody title={ __( 'Settings', 'casazen' ) }>{ renderFields( settings ) }</PanelBody>
					) }
					{ appearance.length > 0 && (
						<PanelBody title={ __( 'Appearance', 'casazen' ) } initialOpen={ false }>
							{ renderFields( appearance ) }
						</PanelBody>
					) }
				</InspectorControls>
				<div { ...blockProps }>
					<Placeholder
						label={ title }
						instructions={ __(
							'This is only a preview. The widget appears on the published page.',
							'casazen'
						) }
					>
						{ chosen.length > 0 && (
							<ul className="casazen-block-values">
								{ chosen.map( ( name ) => (
									<li key={ name }>
										{ fields[ name ].label }: { formatValue( fields[ name ], attributes[ name ] ) }
									</li>
								) ) }
							</ul>
						) }
					</Placeholder>
				</div>
			</>
		);
	};
}
