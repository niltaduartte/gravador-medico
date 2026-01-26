import * as React from "react"

export interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}

export const Select: React.FC<SelectProps> = ({ value, onValueChange, children }) => {
  return (
    <div data-value={value} data-onchange={onValueChange}>
      {children}
    </div>
  )
}

export interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className = "" }) => {
  return (
    <div className={`border rounded px-3 py-2 ${className}`}>
      {children}
    </div>
  )
}

export interface SelectValueProps {
  placeholder?: string
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder }) => {
  return <span className="text-sm">{placeholder}</span>
}

export const SelectContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="absolute mt-1 bg-white border rounded shadow-lg z-10">{children}</div>
}

export interface SelectItemProps {
  value: string
  children: React.ReactNode
}

export const SelectItem: React.FC<SelectItemProps> = ({ value, children }) => {
  return (
    <div data-value={value} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">
      {children}
    </div>
  )
}
