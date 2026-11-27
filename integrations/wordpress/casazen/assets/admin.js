/**
 * The screen of the CasaZen plugin (Settings, then CasaZen): the copy buttons of the DNS records, «Check now» without leaving the
 * page, and the refresh of the state of a domain that waits for its DNS records.
 *
 * No build step and no dependency. Progressive: without this script every button of the screen works through admin-post, the copy
 * buttons stay hidden (the values are selected by hand) and the page shows the state of its last load.
 *
 * The refresh runs only while the section of the domain says so (`data-casazen-poll`, a domain that waits): it asks the server at
 * most every 30 seconds and stops after 15 minutes. The server asks CasaZen at most every 25 seconds, whatever the browser does.
 * The page is reloaded when what it shows has changed (the fingerprint); otherwise only the time of the last check is updated.
 *
 * The data of the page (`casazenAdmin`) are the address of admin-ajax, a nonce and three texts: never the credential of the site.
 */
( function () {
	'use strict';

	/** Milliseconds between two refreshes: at most every 30 seconds. */
	var POLL_INTERVAL_MS = 30 * 1000;

	/** Milliseconds after which the refresh stops: 15 minutes. */
	var POLL_LIMIT_MS = 15 * 60 * 1000;

	var config = window.casazenAdmin || null;

	function text( key ) {
		return config && typeof config[ key ] === 'string' ? config[ key ] : '';
	}

	function canAsk() {
		return Boolean( config && config.ajaxUrl && config.nonce && window.fetch && window.URLSearchParams );
	}

	/** One admin-ajax request with the nonce of the screen; it fails on any answer that is not a 2xx. */
	function ask( action ) {
		var body = new window.URLSearchParams();
		body.set( 'action', action );
		body.set( 'nonce', config.nonce );
		return window
			.fetch( config.ajaxUrl, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: body.toString(),
			} )
			.then( function ( response ) {
				if ( ! response.ok ) {
					throw new Error( 'HTTP ' + response.status );
				}
				return response.json();
			} );
	}

	/** Copies a text: the clipboard of the browser, or the old way where it is not available. */
	function copyText( value ) {
		if ( window.navigator.clipboard && window.isSecureContext ) {
			return window.navigator.clipboard.writeText( value );
		}
		return new Promise( function ( resolve, reject ) {
			var area = document.createElement( 'textarea' );
			var copied = false;
			area.value = value;
			area.setAttribute( 'readonly', '' );
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.appendChild( area );
			area.select();
			try {
				copied = document.execCommand( 'copy' );
			} catch ( error ) {
				copied = false;
			}
			document.body.removeChild( area );
			if ( copied ) {
				resolve();
			} else {
				reject( new Error( 'copy' ) );
			}
		} );
	}

	function setupCopyButtons() {
		var buttons = document.querySelectorAll( 'button[data-casazen-copy]' );
		Array.prototype.forEach.call( buttons, function ( button ) {
			var status = button.nextElementSibling;
			button.hidden = false;
			button.addEventListener( 'click', function () {
				copyText( button.getAttribute( 'data-casazen-copy' ) || '' ).then(
					function () {
						say( status, text( 'copied' ) );
					},
					function () {
						say( status, text( 'copyFailed' ) );
					}
				);
			} );
		} );
	}

	function say( status, message ) {
		if ( ! status || ! status.classList.contains( 'casazen-copy-status' ) ) {
			return;
		}
		status.textContent = message;
		window.setTimeout( function () {
			status.textContent = '';
		}, 4000 );
	}

	/** While a form of a card is on its way, every button of that card is off: one action at a time, never sent twice. */
	function setupBusyCards() {
		var cards = document.querySelectorAll( '.casazen-card' );
		Array.prototype.forEach.call( cards, function ( card ) {
			card.addEventListener( 'submit', function () {
				// After the browser has read the form: a disabled button would leave the data of the form otherwise.
				window.setTimeout( function () {
					setButtons( card, true );
				}, 0 );
			} );
		} );
		// A page shown again from the history of the browser gets its buttons back.
		window.addEventListener( 'pageshow', function ( event ) {
			if ( event.persisted ) {
				Array.prototype.forEach.call( cards, function ( card ) {
					setButtons( card, false );
				} );
			}
		} );
	}

	function setButtons( card, disabled ) {
		Array.prototype.forEach.call( card.querySelectorAll( '[type="submit"]' ), function ( button ) {
			button.disabled = disabled;
		} );
	}

	/** «Check now» without leaving the page; the server keeps the message, and the reloaded page shows it with the new state. */
	function setupVerify() {
		var form = document.querySelector( 'form[data-casazen-verify]' );
		if ( ! form || ! canAsk() ) {
			return;
		}
		form.addEventListener( 'submit', function ( event ) {
			var button = form.querySelector( '[type="submit"]' );
			event.preventDefault();
			if ( form.getAttribute( 'data-casazen-busy' ) === '1' ) {
				return;
			}
			form.setAttribute( 'data-casazen-busy', '1' );
			if ( button ) {
				button.disabled = true;
				if ( text( 'checking' ) ) {
					button.value = text( 'checking' );
				}
			}
			ask( 'casazen_verify' ).then(
				function () {
					window.location.reload();
				},
				function () {
					// The script could not ask: the form goes the usual way, through admin-post.
					HTMLFormElement.prototype.submit.call( form );
				}
			);
		} );
	}

	/** The refresh of a domain that waits: at most every 30 seconds, for at most 15 minutes, never while the tab is hidden. */
	function setupPolling() {
		var section = document.querySelector( '[data-casazen-poll]' );
		var fingerprint;
		var started;
		var busy = false;
		var timer;

		if ( ! section || ! canAsk() ) {
			return;
		}
		fingerprint = section.getAttribute( 'data-casazen-fingerprint' ) || '';
		started = Date.now();

		function stop() {
			window.clearInterval( timer );
		}

		function tick() {
			if ( Date.now() - started >= POLL_LIMIT_MS ) {
				stop();
				return;
			}
			if ( busy || document.hidden ) {
				return;
			}
			busy = true;
			ask( 'casazen_account' )
				.then( function ( reply ) {
					var last;
					if ( ! reply || ! reply.success || ! reply.data ) {
						return;
					}
					if ( reply.data.fingerprint !== fingerprint ) {
						stop();
						window.location.reload();
						return;
					}
					last = section.querySelector( '[data-casazen-last-check]' );
					if ( last && reply.data.lastCheck ) {
						last.textContent = reply.data.lastCheck;
					}
					if ( ! reply.data.pending ) {
						stop();
					}
				} )
				.catch( function () {
					// A failed refresh waits for the next one: the page keeps what it shows.
				} )
				.then( function () {
					busy = false;
				} );
		}

		timer = window.setInterval( tick, POLL_INTERVAL_MS );
	}

	function start() {
		setupCopyButtons();
		setupBusyCards();
		setupVerify();
		setupPolling();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
} )();
