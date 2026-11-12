import { rpc } from "./api-client";
export const accessStatus = rpc<typeof import("../../api/access").accessStatus>("accessStatus");
export const startGitHub = rpc<typeof import("../../api/access").startGitHub>("startGitHub");
export const completeGitHub =
  rpc<typeof import("../../api/access").completeGitHub>("completeGitHub");
export const startTrial = rpc<typeof import("../../api/access").startTrial>("startTrial");
export const recheckSponsor =
  rpc<typeof import("../../api/access").recheckSponsor>("recheckSponsor");
