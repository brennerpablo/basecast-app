"use client"

import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import * as React from "react"
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext} from "react-hook-form"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const Form = FormProvider

/**
 * Optional, opt-in mechanism to visually highlight specific fields by name
 * (e.g. values populated by an auto-match). Inert unless a
 * `FieldHighlightProvider` is mounted above the fields, so every other
 * `FormControl` in the app is unaffected.
 */
type FieldHighlightContextValue = {
  isHighlighted: (name: string) => boolean
  /**
   * Origem do valor auto-preenchido, quando conhecida. O rótulo do campo mostra
   * um chip ("XML" / "Mercado" / "XML+Mercado") — sem isto o usuário vê a borda
   * verde e não sabe de onde o dado veio, que é metade da transparência.
   */
  fieldSource?: (name: string) => FieldSourceInfo | null
}

export type FieldSourceInfo = {
  label: string
  /** Texto de tooltip: fundo e data do XML, ou as bases de mercado. */
  detail?: string
}

const FieldHighlightContext =
  React.createContext<FieldHighlightContextValue | null>(null)

const FieldHighlightProvider = ({
  isHighlighted,
  fieldSource,
  children}: {
  isHighlighted: (name: string) => boolean
  fieldSource?: (name: string) => FieldSourceInfo | null
  children: React.ReactNode
}) => {
  const value = React.useMemo(
    () => ({ isHighlighted, fieldSource }),
    [isHighlighted, fieldSource]
  )
  return (
    <FieldHighlightContext.Provider value={value}>
      {children}
    </FieldHighlightContext.Provider>
  )
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>")
  }

  const fieldState = getFieldState(fieldContext.name, formState)

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState}
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue | null>(null)

const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"

const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, children, ...props }, ref) => {
  const { error, formItemId, name } = useFormField()
  const highlight = React.useContext(FieldHighlightContext)
  const source = highlight?.fieldSource?.(name) ?? null

  return (
    <Label
      ref={ref}
      className={cn(
        error && "text-destructive",
        source && "flex items-center gap-1.5",
        className
      )}
      htmlFor={formItemId}
      {...props}
    >
      {children}
      {source ? (
        <span
          className="rounded-sm bg-emerald-50 px-1.5 py-px text-[10px] font-medium text-emerald-700"
          title={source.detail}
        >
          {source.label}
        </span>
      ) : null}
    </Label>
  )
})
FormLabel.displayName = "FormLabel"

const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ className, ...props }, ref) => {
  const { error, name, formItemId, formDescriptionId, formMessageId } =
    useFormField()
  const highlight = React.useContext(FieldHighlightContext)
  const highlighted = highlight?.isHighlighted(name) ?? false

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      // twMerge (via each control's own cn) lets this win over `border-input`.
      className={cn(
        highlighted && "border-emerald-500 ring-1 ring-emerald-500/40",
        className
      )}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()

  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})
FormDescription.displayName = "FormDescription"

const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : children

  if (!body) {
    return null
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  )
})
FormMessage.displayName = "FormMessage"

export {
  FieldHighlightProvider,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField}
