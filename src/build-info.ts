declare const __STUDIO_BUILD__: { id: string; at: string } | undefined;
/** The Studio build this app is: its commit and when it was built. */
export const STUDIO_BUILD: { id: string; at: string } = typeof __STUDIO_BUILD__ !== "undefined" ? __STUDIO_BUILD__ : { id: "dev", at: "" };
