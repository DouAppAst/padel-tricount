import { createContext, useContext } from 'react'

export type Notify = (message: string, action?: { label: string; onClick: () => void }) => void

export const NotifyContext = createContext<Notify>(() => {})

export const useNotify = () => useContext(NotifyContext)
