"use client"

// Re-export AuPacketModal as the canonical order status control.
// The modal handles INFO_SENT_TO_VENDOR with AU packet reveal; all other
// transitions advance directly.
export { default } from "./AuPacketModal"
