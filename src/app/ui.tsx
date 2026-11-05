"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, Chip, FieldError, Input, Label, Link, ListBox, Select, TextField } from "@heroui/react";

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

const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

export function WeekdaySelect() {
  return <Select name="weekday" defaultValue="1" isRequired className="app-field">
    <Label>Ukedag</Label>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{weekdays.map((day, index) =>
      <ListBox.Item id={String(index + 1)} key={day} textValue={day}>{day}<ListBox.ItemIndicator /></ListBox.Item>,
    )}</ListBox></Select.Popover>
  </Select>;
}

export function MemberSelect({ members }: { members: { userId: string; email: string }[] }) {
  return <Select name="userId" isRequired className="app-field" placeholder="Velg gruppemedlem">
    <Label>Ny hovedtrener</Label>
    <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{members.map((member) =>
      <ListBox.Item id={member.userId} key={member.userId} textValue={member.email}>{member.email}<ListBox.ItemIndicator /></ListBox.Item>,
    )}</ListBox></Select.Popover>
  </Select>;
}
