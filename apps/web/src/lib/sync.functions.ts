import { rpc } from "./api-client";
export const getSyncStatus = rpc<typeof import("../../api/sync").getSyncStatus>("getSyncStatus");
export const authenticate = rpc<typeof import("../../api/sync").authenticate>("authenticate");
export const signOut = rpc<typeof import("../../api/sync").signOut>("signOut");
export const listRemoteReports =
  rpc<typeof import("../../api/sync").listRemoteReports>("listRemoteReports");
export const uploadReport = rpc<typeof import("../../api/sync").uploadReport>("uploadReport");
export const deleteRemoteReport =
  rpc<typeof import("../../api/sync").deleteRemoteReport>("deleteRemoteReport");
