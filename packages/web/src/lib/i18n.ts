"use client";

import { useState, useEffect, useCallback } from "react";

export type Locale = "de" | "en" | "fr" | "es" | "nl";

const translations = {
  de: {
    // Booking page
    "booking.unavailable": "Diese Buchungsseite ist nicht verfügbar.",
    "booking.notFound": "Nicht gefunden",
    "booking.dateTime": "Datum & Uhrzeit",
    "booking.yourDetails": "Deine Angaben",
    "booking.name": "Name",
    "booking.email": "E-Mail",
    "booking.notes": "Notizen (optional)",
    "booking.submit": "Termin buchen",
    "booking.back": "Zurück",
    "booking.confirmed": "Steht.",
    "booking.calendarInvite": "Kalendereinladung ist unterwegs.",
    "booking.redirecting": "Weiterleitung in {seconds}s...",
    "booking.continue": "Weiter",
    "booking.loading": "Laden...",
    "booking.noSlots": "Keine verfügbaren Zeitslots",
    "booking.onlineMeeting": "Online-Meeting",
    "booking.nameEmailRequired": "Name und E-Mail sind erforderlich.",
    "booking.invalidEmail": "Bitte gib eine gültige E-Mail-Adresse ein.",
    "booking.failed": "Buchung fehlgeschlagen. Der Zeitslot ist möglicherweise nicht mehr verfügbar.",
    "booking.min": "min",
    // Manage page
    "manage.notFound": "Buchung nicht gefunden.",
    "manage.cancelled": "Buchung abgesagt",
    "manage.findNew": "Neuen Termin suchen",
    "manage.when": "Wann",
    "manage.guest": "Gast",
    "manage.notesLabel": "Notizen",
    "manage.reschedule": "Verschieben",
    "manage.cancel": "Absagen",
    "manage.chooseNew": "Neuen Termin wählen",
    "manage.availableTimes": "Verfügbare Zeiten am {date}",
    "manage.noTimes": "Keine verfügbaren Zeiten.",
    // Shortlink
    "short.notFound": "Buchungsseite nicht gefunden",
    "short.confirmed": "Buchung bestätigt",
    "short.emailInvite": "Du erhältst eine Kalendereinladung per E-Mail.",
    // Error page
    "error.title": "Buchungsseite nicht verfügbar",
    "error.message": "Beim Laden der Buchungsseite ist ein Fehler aufgetreten. Bitte versuche es erneut.",
    "error.retry": "Erneut versuchen",
    // Footer
    "footer.tagline": "Nie wieder doppelt gebucht — mein-kalender.link",
    // Day labels
    "days.mo": "Mo", "days.tu": "Di", "days.we": "Mi", "days.th": "Do",
    "days.fr": "Fr", "days.sa": "Sa", "days.su": "So",
  },
  en: {
    "booking.unavailable": "This booking page is not available.",
    "booking.notFound": "Not found",
    "booking.dateTime": "Date & Time",
    "booking.yourDetails": "Your Details",
    "booking.name": "Name",
    "booking.email": "Email",
    "booking.notes": "Notes (optional)",
    "booking.submit": "Book appointment",
    "booking.back": "Back",
    "booking.confirmed": "Confirmed.",
    "booking.calendarInvite": "Calendar invite is on its way.",
    "booking.redirecting": "Redirecting in {seconds}s...",
    "booking.continue": "Continue",
    "booking.loading": "Loading...",
    "booking.noSlots": "No available time slots",
    "booking.onlineMeeting": "Online Meeting",
    "booking.nameEmailRequired": "Name and email are required.",
    "booking.invalidEmail": "Please enter a valid email address.",
    "booking.failed": "Booking failed. The time slot may no longer be available.",
    "booking.min": "min",
    "manage.notFound": "Booking not found.",
    "manage.cancelled": "Booking cancelled",
    "manage.findNew": "Find a new time",
    "manage.when": "When",
    "manage.guest": "Guest",
    "manage.notesLabel": "Notes",
    "manage.reschedule": "Reschedule",
    "manage.cancel": "Cancel",
    "manage.chooseNew": "Choose a new time",
    "manage.availableTimes": "Available times on {date}",
    "manage.noTimes": "No available times.",
    "short.notFound": "Booking page not found",
    "short.confirmed": "Booking confirmed",
    "short.emailInvite": "You will receive a calendar invite by email.",
    "error.title": "Booking page unavailable",
    "error.message": "An error occurred while loading the booking page. Please try again.",
    "error.retry": "Try again",
    "footer.tagline": "Never double-booked — mein-kalender.link",
    "days.mo": "Mo", "days.tu": "Tu", "days.we": "We", "days.th": "Th",
    "days.fr": "Fr", "days.sa": "Sa", "days.su": "Su",
  },
  fr: {
    "booking.unavailable": "Cette page de réservation n'est pas disponible.",
    "booking.notFound": "Non trouvé",
    "booking.dateTime": "Date et heure",
    "booking.yourDetails": "Vos coordonnées",
    "booking.name": "Nom",
    "booking.email": "E-mail",
    "booking.notes": "Notes (facultatif)",
    "booking.submit": "Réserver",
    "booking.back": "Retour",
    "booking.confirmed": "Confirmé.",
    "booking.calendarInvite": "L'invitation calendrier est en route.",
    "booking.redirecting": "Redirection dans {seconds}s...",
    "booking.continue": "Continuer",
    "booking.loading": "Chargement...",
    "booking.noSlots": "Aucun créneau disponible",
    "booking.onlineMeeting": "Réunion en ligne",
    "booking.nameEmailRequired": "Le nom et l'e-mail sont requis.",
    "booking.invalidEmail": "Veuillez saisir une adresse e-mail valide.",
    "booking.failed": "Réservation échouée. Le créneau n'est peut-être plus disponible.",
    "booking.min": "min",
    "manage.notFound": "Réservation introuvable.",
    "manage.cancelled": "Réservation annulée",
    "manage.findNew": "Chercher un nouveau créneau",
    "manage.when": "Quand",
    "manage.guest": "Invité",
    "manage.notesLabel": "Notes",
    "manage.reschedule": "Reporter",
    "manage.cancel": "Annuler",
    "manage.chooseNew": "Choisir un nouveau créneau",
    "manage.availableTimes": "Créneaux disponibles le {date}",
    "manage.noTimes": "Aucun créneau disponible.",
    "short.notFound": "Page de réservation introuvable",
    "short.confirmed": "Réservation confirmée",
    "short.emailInvite": "Vous recevrez une invitation calendrier par e-mail.",
    "error.title": "Page de réservation indisponible",
    "error.message": "Une erreur est survenue lors du chargement. Veuillez réessayer.",
    "error.retry": "Réessayer",
    "footer.tagline": "Plus jamais de double réservation — mein-kalender.link",
    "days.mo": "Lu", "days.tu": "Ma", "days.we": "Me", "days.th": "Je",
    "days.fr": "Ve", "days.sa": "Sa", "days.su": "Di",
  },
  es: {
    "booking.unavailable": "Esta página de reserva no está disponible.",
    "booking.notFound": "No encontrado",
    "booking.dateTime": "Fecha y hora",
    "booking.yourDetails": "Tus datos",
    "booking.name": "Nombre",
    "booking.email": "Correo electrónico",
    "booking.notes": "Notas (opcional)",
    "booking.submit": "Reservar cita",
    "booking.back": "Volver",
    "booking.confirmed": "Confirmado.",
    "booking.calendarInvite": "La invitación de calendario está en camino.",
    "booking.redirecting": "Redirigiendo en {seconds}s...",
    "booking.continue": "Continuar",
    "booking.loading": "Cargando...",
    "booking.noSlots": "No hay horarios disponibles",
    "booking.onlineMeeting": "Reunión en línea",
    "booking.nameEmailRequired": "Nombre y correo electrónico son obligatorios.",
    "booking.invalidEmail": "Por favor, introduce una dirección de correo electrónico válida.",
    "booking.failed": "Reserva fallida. Es posible que el horario ya no esté disponible.",
    "booking.min": "min",
    "manage.notFound": "Reserva no encontrada.",
    "manage.cancelled": "Reserva cancelada",
    "manage.findNew": "Buscar nuevo horario",
    "manage.when": "Cuándo",
    "manage.guest": "Invitado",
    "manage.notesLabel": "Notas",
    "manage.reschedule": "Reprogramar",
    "manage.cancel": "Cancelar",
    "manage.chooseNew": "Elegir nuevo horario",
    "manage.availableTimes": "Horarios disponibles el {date}",
    "manage.noTimes": "No hay horarios disponibles.",
    "short.notFound": "Página de reserva no encontrada",
    "short.confirmed": "Reserva confirmada",
    "short.emailInvite": "Recibirás una invitación de calendario por correo.",
    "error.title": "Página de reserva no disponible",
    "error.message": "Se produjo un error al cargar la página. Por favor, inténtalo de nuevo.",
    "error.retry": "Intentar de nuevo",
    "footer.tagline": "Nunca más reservas dobles — mein-kalender.link",
    "days.mo": "Lu", "days.tu": "Ma", "days.we": "Mi", "days.th": "Ju",
    "days.fr": "Vi", "days.sa": "Sá", "days.su": "Do",
  },
  nl: {
    "booking.unavailable": "Deze boekingspagina is niet beschikbaar.",
    "booking.notFound": "Niet gevonden",
    "booking.dateTime": "Datum & tijd",
    "booking.yourDetails": "Jouw gegevens",
    "booking.name": "Naam",
    "booking.email": "E-mail",
    "booking.notes": "Notities (optioneel)",
    "booking.submit": "Afspraak boeken",
    "booking.back": "Terug",
    "booking.confirmed": "Bevestigd.",
    "booking.calendarInvite": "Agenda-uitnodiging is onderweg.",
    "booking.redirecting": "Doorsturen in {seconds}s...",
    "booking.continue": "Verder",
    "booking.loading": "Laden...",
    "booking.noSlots": "Geen beschikbare tijdslots",
    "booking.onlineMeeting": "Online vergadering",
    "booking.nameEmailRequired": "Naam en e-mail zijn verplicht.",
    "booking.invalidEmail": "Voer een geldig e-mailadres in.",
    "booking.failed": "Boeking mislukt. Het tijdslot is mogelijk niet meer beschikbaar.",
    "booking.min": "min",
    "manage.notFound": "Boeking niet gevonden.",
    "manage.cancelled": "Boeking geannuleerd",
    "manage.findNew": "Nieuwe afspraak zoeken",
    "manage.when": "Wanneer",
    "manage.guest": "Gast",
    "manage.notesLabel": "Notities",
    "manage.reschedule": "Verplaatsen",
    "manage.cancel": "Annuleren",
    "manage.chooseNew": "Kies een nieuwe tijd",
    "manage.availableTimes": "Beschikbare tijden op {date}",
    "manage.noTimes": "Geen beschikbare tijden.",
    "short.notFound": "Boekingspagina niet gevonden",
    "short.confirmed": "Boeking bevestigd",
    "short.emailInvite": "Je ontvangt een agenda-uitnodiging per e-mail.",
    "error.title": "Boekingspagina niet beschikbaar",
    "error.message": "Er is een fout opgetreden bij het laden. Probeer het opnieuw.",
    "error.retry": "Opnieuw proberen",
    "footer.tagline": "Nooit meer dubbel geboekt — mein-kalender.link",
    "days.mo": "Ma", "days.tu": "Di", "days.we": "Wo", "days.th": "Do",
    "days.fr": "Vr", "days.sa": "Za", "days.su": "Zo",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

const LOCALE_STORAGE_KEY = "mk-locale";

const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  es: "Español",
  nl: "Nederlands",
};

const localeFlags: Record<Locale, string> = {
  de: "DE",
  en: "EN",
  fr: "FR",
  es: "ES",
  nl: "NL",
};

function detectLocale(): Locale {
  // Check localStorage first
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && stored in translations) return stored as Locale;
  }

  // Browser language
  if (typeof navigator !== "undefined") {
    const lang = navigator.language.split("-")[0].toLowerCase();
    if (lang in translations) return lang as Locale;
  }

  return "en";
}

// Map locale to BCP 47 for toLocaleString
function toBcp47(locale: Locale): string {
  return { de: "de-DE", en: "en-US", fr: "fr-FR", es: "es-ES", nl: "nl-NL" }[locale];
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(detectLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem(LOCALE_STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[locale] || translations.en;
      let text = (dict as Record<string, string>)[key] || (translations.en as Record<string, string>)[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale]
  );

  const dayLabels = [
    t("days.mo"), t("days.tu"), t("days.we"), t("days.th"),
    t("days.fr"), t("days.sa"), t("days.su"),
  ];

  const bcp47 = toBcp47(locale);

  const formatTime = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(bcp47, { hour: "2-digit", minute: "2-digit" }),
    [bcp47]
  );

  const formatDate = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    [bcp47]
  );

  const formatMonth = useCallback(
    (date: Date) => date.toLocaleDateString(bcp47, { month: "long", year: "numeric" }),
    [bcp47]
  );

  const formatShortDate = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(bcp47, { day: "numeric", month: "short" }),
    [bcp47]
  );

  const formatDateTime = useCallback(
    (iso: string) => new Date(iso).toLocaleString(bcp47, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    [bcp47]
  );

  const formatDateLong = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(bcp47, { weekday: "long", day: "numeric", month: "long" }),
    [bcp47]
  );

  return {
    locale,
    setLocale,
    t,
    mounted,
    dayLabels,
    bcp47,
    formatTime,
    formatDate,
    formatMonth,
    formatShortDate,
    formatDateTime,
    formatDateLong,
    localeLabels,
    localeFlags,
    allLocales: Object.keys(translations) as Locale[],
  };
}
