=== CasaZen ===
Contributors: casazen
Tags: booking, vacation rental, reservations, availability, short-term rental
Requires at least: 6.4
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connects your WordPress site to CasaZen, so that your booking engine and your guest area appear on your own pages.

== Description ==

CasaZen is the management software of holiday-rental agencies. This plugin connects your WordPress site to the address that your agency uses with CasaZen, so that the booking engine and the guest area can appear on your own pages.

The PHP of the plugin is thin on purpose: the behaviour of the widgets lives in a small script that CasaZen serves from your own address, so a change of the widgets never needs a plugin update.

This first version provides the foundation:

* a settings page (Settings, then CasaZen) with the address of your CasaZen booking site, an optional organisation slug, a language mapping and a switch for the script;
* a connection test that tells you which agency answers at that address and whether embedding is switched on for it;
* texts in English and Italian;
* a clean uninstall: it removes the settings, the cached results and the scheduled events, and leaves your pages alone.

Blocks and shortcodes for the widgets arrive with the next versions.

The payment of a booking never happens inside a frame: the booking engine takes the guest to the checkout page of your CasaZen address.

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`, or install the ZIP from Plugins, Add New, Upload Plugin.
2. Activate the plugin.
3. Open Settings, then CasaZen. Enter the address of your CasaZen booking site and press Test connection.

== Frequently Asked Questions ==

= Do I need a CasaZen account? =

Yes. The plugin only shows what your agency publishes with CasaZen. While no address is set in the settings the plugin does nothing.

= Does the plugin send data about my visitors to CasaZen? =

No. When a visitor opens a page of your site, your server does not call CasaZen. The widgets are loaded by the browser of the visitor from your CasaZen address, like any other embedded content.

== Changelog ==

= 0.1.0 =
* First version: settings page, connection test with a 12 hour cache, English and Italian texts, clean uninstall.

== External services ==

This plugin connects to the CasaZen service of your agency, at the address that you enter in the settings (for example https://prenota.example.com).

* What the service is and what it is used for: CasaZen is the booking software of your agency. The plugin asks it which agency answers at your address and whether embedding is switched on, and the browser of your visitors loads the booking widgets from it.
* What is sent, and when: the server of your site requests `<address>/embed/v1/manifest.json` and the CasaZen API named in that file (`/api/public/resolve-host` and, in the next versions, the destinations of the search bar). It does so only from the settings screen (when you save the address and when you press Test connection) and from a background event that renews the result after 12 hours. The only data sent is the host name of your address, inside the address of the request, and the name and version of the plugin as the user agent. No cookie, no personal data and no data about your visitors is sent, and a page that a visitor opens never starts these requests.
* The browser of your visitors loads the script and the frames of the widgets from your CasaZen address (`<address>/embed/v1/embed.js`).
* Privacy notice: `<address>/legale/privacy`, for example https://prenota.example.com/legale/privacy.
