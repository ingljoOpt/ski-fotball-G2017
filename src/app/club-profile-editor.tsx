"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { brandingSchema, DEFAULT_ACCENT, DEFAULT_PRIMARY, LOGO_TYPES, MAX_LOGO_BYTES, MAX_LOGO_DIMENSION, type ClubBranding } from "@/lib/branding";
import { saveClubProfile, resetClubProfile } from "./actions";
import { ActionButton, AppLink, Card, NativeInput, SubmitButton } from "./ui";
import { ClubIdentity, ClubTheme } from "./club-theme";

export function ClubProfileEditor({ clubId, club }: { clubId: string; club: ClubBranding }) {
  const [primaryColor, setPrimaryColor] = useState(club.primaryColor);
  const [accentColor, setAccentColor] = useState(club.accentColor);
  const [previewLogo, setPreviewLogo] = useState(club.logoData);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState("");
  const objectUrl = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  const colors = brandingSchema.safeParse({ primaryColor, accentColor });
  const preview = { ...club, primaryColor, accentColor, logoData: removeLogo ? null : previewLogo };

  function clearSelection() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    if (fileInput.current) fileInput.current.value = "";
    setPreviewLogo(club.logoData);
    setLogoError("");
  }

  return <Card className="app-card profile-editor">
    <h2>Klubbprofil</h2>
    <p>Velg klubbens farger og logo. Forhåndsvisningen er lokal til du lagrer.</p>
    <form action={saveClubProfile}>
      <input type="hidden" name="clubId" value={clubId} />
      {removeLogo && <input type="hidden" name="removeLogo" value="on" />}
      <div className="profile-colors">
        <NativeInput label={`Primærfarge (${primaryColor})`} type="color" name="primaryColor" value={primaryColor}
          onChange={(event) => setPrimaryColor(event.target.value)} required />
        <NativeInput label={`Aksentfarge (${accentColor})`} type="color" name="accentColor" value={accentColor}
          onChange={(event) => setAccentColor(event.target.value)} required />
      </div>
      <p className="muted">Primærfargen brukes på knapper og lenker og må ha minst 4,5:1 kontrast mot hvitt og sidens lyse bakgrunn. Aksentfargen brukes i klubbmerket, med automatisk svart eller hvit tekst.</p>
      {!colors.success && <p className="notice error" role="alert">{colors.error.issues.map((issue) => issue.message).join(" ")}</p>}
      <NativeInput label="Last opp klubblogo" type="file" name="logo" ref={fileInput} accept={LOGO_TYPES.join(",")}
        aria-describedby="logo-help" onChange={(event) => {
          const file = event.target.files?.[0];
          if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
          objectUrl.current = null;
          setRemoveLogo(false);
          setLogoError("");
          setPreviewLogo(club.logoData);
          if (!file) return;
          if (!LOGO_TYPES.includes(file.type) || file.size > MAX_LOGO_BYTES || file.size === 0) {
            setLogoError("Velg en PNG-, JPEG- eller WebP-fil på maksimalt 512 KiB.");
            return;
          }
          objectUrl.current = URL.createObjectURL(file);
          setPreviewLogo(objectUrl.current);
        }} />
      <small id="logo-help">Statisk PNG, JPEG eller WebP. Maksimalt 512 KiB og 2048 × 2048 piksler. Serveren kontrollerer bildet, fjerner metadata og lagrer en WebP-logo på opptil 512 × 512 piksler.</small>
      {logoError && <p className="notice error" role="alert">{logoError} Velg en annen fil, eller avbryt logovalget.</p>}
      <div className="row">
        <ActionButton variant="secondary" onPress={clearSelection}>Avbryt logovalg</ActionButton>
        {club.logoData && <ActionButton variant="danger-soft" onPress={() => {
          clearSelection();
          setRemoveLogo((value) => !value);
        }}>{removeLogo ? "Behold lagret logo" : "Fjern logo ved lagring"}</ActionButton>}
      </div>
      <section aria-label="Forhåndsvisning av klubbprofil">
        <h3>Forhåndsvisning</h3>
        <ClubTheme club={preview}>
          <div className="profile-preview">
            {preview.logoData ? <Image className="club-logo" src={preview.logoData} width={96} height={96} unoptimized
              alt={`Logo for ${club.name}`} onLoad={(event) => {
                if (event.currentTarget.naturalWidth > MAX_LOGO_DIMENSION || event.currentTarget.naturalHeight > MAX_LOGO_DIMENSION) {
                  setLogoError("Logoen kan være maksimalt 2048 × 2048 piksler.");
                }
              }} onError={() => setLogoError("Bildet kunne ikke vises. Velg en gyldig bildefil.")} /> : null}
            <ClubIdentity club={{ ...preview, logoData: null }} />
            <AppLink href="#klubbprofil">Eksempel på lenke</AppLink>
            <ActionButton isDisabled={!colors.success}>Eksempelknapp</ActionButton>
          </div>
        </ClubTheme>
      </section>
      <SubmitButton isDisabled={!colors.success || Boolean(logoError)}>Lagre klubbprofil</SubmitButton>
    </form>
    <form action={resetClubProfile} onSubmit={() => {
      clearSelection();
      setPrimaryColor(DEFAULT_PRIMARY);
      setAccentColor(DEFAULT_ACCENT);
      setPreviewLogo(null);
      setRemoveLogo(false);
    }}>
      <input type="hidden" name="clubId" value={clubId} />
      <SubmitButton variant="secondary">Tilbakestill farger og fjern logo</SubmitButton>
    </form>
    <small>Tilbakestilling lagrer standardprofilen umiddelbart.</small>
  </Card>;
}
