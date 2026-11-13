"use client";

import { useCallback, useId, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, Chip, FieldError, Input, Label, Link, ListBox, Select, TextArea, TextField } from "@heroui/react";

export { Card, Chip };

export function SubmitButton({ children, variant = "primary", ...props }: Omit<ComponentProps<typeof Button>, "children"> & { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" variant={variant} isPending={pending} isDisabled={pending || props.isDisabled}>{children}</Button>;
}

export function ActionButton(props: ComponentProps<typeof Button>) {
  return <Button {...props} />;
}

export function AppLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <Link className={className} href={href}>{children}</Link>;
}

export function TextInput({ label, ...props }: ComponentProps<typeof TextField> & { label: string; placeholder?: string }) {
  const { placeholder, ...fieldProps } = props;
  return <TextField {...fieldProps} className="app-field">
    <Label>{label}</Label><Input placeholder={placeholder} /><FieldError />
  </TextField>;
}

export function NativeInput({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const id = useId();
  return <div className="app-field"><Label htmlFor={id}>{label}</Label><Input {...props} id={id} /></div>;
}

export function TextAreaInput({ label, ...props }: ComponentProps<typeof TextArea> & { label: string }) {
  const id = useId();
  return <div className="app-field"><Label htmlFor={id}>{label}</Label><TextArea {...props} id={id} /></div>;
}

export function OptionSelect({ label, options, ...props }: ComponentProps<typeof Select> & {
  label: string; options: { id: string; label: string }[];
}) {
  const [dialog, setDialog] = useState<HTMLDialogElement | undefined>();
  // A native modal makes popovers outside the dialog inert.
  const triggerRef = useCallback((element: HTMLButtonElement | null) => {
    setDialog(element?.closest("dialog") ?? undefined);
  }, []);
  return <Select {...props} className="app-field">
    <Label>{label}</Label>
    <Select.Trigger ref={triggerRef}><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover UNSTABLE_portalContainer={dialog}><ListBox>{options.map((option) =>
      <ListBox.Item id={option.id} key={option.id} textValue={option.label}>{option.label}<ListBox.ItemIndicator /></ListBox.Item>,
    )}</ListBox></Select.Popover>
  </Select>;
}
export const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function WeekdaySelect({ defaultValue = "1" }: { defaultValue?: string }) {
  return <OptionSelect label="Ukedag" name="weekday" defaultValue={defaultValue} isRequired
    options={weekdays.map((day, index) => ({ id: String(index + 1), label: day }))} />;
}

export function MemberSelect({ members }: { members: { userId: string; email: string }[] }) {
  return <OptionSelect label="Ny hovedtrener" name="userId" isRequired placeholder="Velg lagmedlem"
    options={members.map((member) => ({ id: member.userId, label: member.email }))} />;
}
