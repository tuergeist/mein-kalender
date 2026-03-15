export { GoogleCalendarProvider } from "./google";
export { OutlookCalendarProvider } from "./outlook";

import { CalendarProviderInterface, Provider } from "../types";
import { GoogleCalendarProvider } from "./google";
import { OutlookCalendarProvider } from "./outlook";

export function getProvider(providerName: string): CalendarProviderInterface {
  switch (providerName) {
    case Provider.GOOGLE:
      return new GoogleCalendarProvider(
        process.env.GOOGLE_CALENDAR_CLIENT_ID!,
        process.env.GOOGLE_CALENDAR_CLIENT_SECRET!
      );
    case Provider.OUTLOOK:
      return new OutlookCalendarProvider(
        process.env.MICROSOFT_CALENDAR_CLIENT_ID!,
        process.env.MICROSOFT_CALENDAR_CLIENT_SECRET!,
        process.env.MICROSOFT_TENANT_ID
      );
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
