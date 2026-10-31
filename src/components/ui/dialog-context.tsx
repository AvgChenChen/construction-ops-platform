"use client";

import { createContext, useContext } from "react";

/** Lets a form inside a dialog close it after a successful submit. */
export const DialogContext = createContext<{ close: () => void } | null>(null);
export const useDialog = () => useContext(DialogContext);
