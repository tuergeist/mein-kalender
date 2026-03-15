export { GoogleCalendarProvider } from "./google";
export { OutlookCalendarProvider } from "./outlook";
export { ProtonCalendarProvider } from "./proton";

import { CalendarProviderInterface, Provider } from "../types";
import { GoogleCalendarProvider } from "./google";
import { OutlookCalendarProvider } from "./outlook";
import { ProtonCalendarProvider } from "./proton";

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
    case Provider.PROTON:
      return new ProtonCalendarProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
