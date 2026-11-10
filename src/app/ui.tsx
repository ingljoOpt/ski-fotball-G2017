"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
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
  return <Select {...props} className="app-field">
    <Label>{label}</Label>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{options.map((option) =>
      <ListBox.Item id={option.id} key={option.id} textValue={option.label}>{option.label}<ListBox.ItemIndicator /></ListBox.Item>,
    )}</ListBox></Select.Popover>
  </Select>;
}
export const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function WeekdaySelect({ defaultValue = "1", native = false }: { defaultValue?: string; native?: boolean }) {
  const id = useId();
  if (native) return <div className="app-field"><Label htmlFor={id}>Ukedag</Label>
    <select id={id} name="weekday" defaultValue={defaultValue} required>{weekdays.map((day, index) =>
      <option value={String(index + 1)} key={day}>{day}</option>,
    )}</select>
  </div>;
  return <Select name="weekday" defaultValue={defaultValue} isRequired className="app-field">
    <Label>Ukedag</Label>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{weekdays.map((day, index) =>
      <ListBox.Item id={String(index + 1)} key={day} textValue={day}>{day}<ListBox.ItemIndicator /></ListBox.Item>,
    )}</ListBox></Select.Popover>
  </Select>;
}

export function MemberSelect({ members }: { members: { userId: string; email: string }[] }) {
  return <Select name="userId" isRequired className="app-field" placeholder="Velg lagmedlem">
    <Label>Ny hovedtrener</Label>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{members.map((member) =>
      <ListBox.Item id={member.userId} key={member.userId} textValue={member.email}>{member.email}<ListBox.ItemIndicator /></ListBox.Item>,
    )}</ListBox></Select.Popover>
  </Select>;
}
