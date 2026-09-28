/**
 * Handler adapter exposing lgpd-export-worker to the event_log dispatcher.
 *
 * Consumed key: `lgpd-export-worker.v1` — recorded in
 * `event_log.consumed_by[]` so retries skip already-completed runs.
 */

import type { EventHandler } from "@/lib/event-log/dispatcher";

export const LGPD_EXPORT_HANDLER_KEY = "lgpd-export-worker.v1";

export const lgpdExportHandler: EventHandler = {
  key: LGPD_EXPORT_HANDLER_KEY,
  events: ["lgpd.data_request_received"],
  async handle(row) {
    const { processLgpdExport } = await import("@/workers/lgpd-export-worker");
    return processLgpdExport(row);
  },
};
