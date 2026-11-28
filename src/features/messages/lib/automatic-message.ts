const CHECK_IN_LINK = /\S*\/checkin\/\S+/gi;

/**
 * The text of an automatic message of CasaZen (`origin: Automation`: the check-in link in the chat of the portal, E23/F01) for a reader who may not copy the link (no
 * `booking.write`): the link in it is replaced by `placeholder`, so the secret is not on screen, neither in the bubble of the conversation nor in the preview of the list. It is
 * the rule of `linkToCopy` of the guest panel of the booking, which gives the link only to who may copy it; the server does not hide it in the text of the message (a follow-up
 * of the backend), so the page does not show it.
 */
export function hideCheckInLink(text: string, placeholder: string): string {
  return text.replace(CHECK_IN_LINK, placeholder);
}
