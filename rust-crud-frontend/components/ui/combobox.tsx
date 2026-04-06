"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export interface ComboboxOption {
  value: string
  label: string
  image?: string | null
  description?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value = [],
  onChange,
  placeholder = "Select items...",
  emptyText = "No item found.",
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedValues, setSelectedValues] = React.useState<string[]>(value)

  React.useEffect(() => {
    setSelectedValues(value)
  }, [value])

  const handleSelect = (currentValue: string) => {
    const newSelectedValues = selectedValues.includes(currentValue)
      ? selectedValues.filter((v) => v !== currentValue)
      : [...selectedValues, currentValue]
    
    setSelectedValues(newSelectedValues)
    onChange?.(newSelectedValues)
  }

  const handleRemove = (valueToRemove: string) => {
    const newSelectedValues = selectedValues.filter((v) => v !== valueToRemove)
    setSelectedValues(newSelectedValues)
    onChange?.(newSelectedValues)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 py-2 px-3"
            disabled={disabled}
          >
            <div className="flex flex-wrap gap-1 items-center w-full">
              {selectedValues.length > 0 ? (
                selectedValues.map((val) => {
                  const option = options.find((opt) => opt.value === val)
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="mr-1 mb-1 pl-1 pr-2 py-0.5 h-7 flex items-center gap-1 bg-secondary hover:bg-secondary/80 border-secondary-foreground/10"
                    >
                      {option?.image && (
                        <Avatar className="h-5 w-5 mr-1">
                          <AvatarImage src={option.image} alt={option.label} />
                          <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                            {option.label.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className="text-xs font-medium">{option?.label || val}</span>
                      <div
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRemove(val)
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemove(val)
                        }}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </div>
                    </Badge>
                  )
                })
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label} // Search by label
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedValues.includes(option.value)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 w-full">
                      {option.image && (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={option.image} alt={option.label} />
                          <AvatarFallback className="text-[10px]">
                            {option.label.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
