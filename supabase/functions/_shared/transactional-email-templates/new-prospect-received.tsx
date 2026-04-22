/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles, PRAGMA_ADMIN_EMAILS } from './_pragma-styles.ts'

interface Props { prospectName?: string; companyName?: string; vertical?: string; subNiche?: string; market?: string; adminUrl?: string }

const NewProspectEmail = ({ prospectName, companyName, vertical, subNiche, market, adminUrl }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Nuevo prospect en Pragma</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.card}>
          <Heading style={styles.h1}>🆕 Nuevo prospect</Heading>
          <Text style={styles.text}>
            <strong>{prospectName || 'Un prospect'}</strong>{companyName ? ` — ${companyName}` : ''} ha enviado el briefing.
          </Text>
          {(vertical || subNiche || market) && (
            <Text style={styles.highlight}>
              {market && <>📍 {market}<br /></>}
              {vertical && <>🎯 {vertical}{subNiche ? ` · ${subNiche}` : ''}</>}
            </Text>
          )}
          {adminUrl && (
            <Button style={styles.button} href={adminUrl}>Abrir prospect</Button>
          )}
          <Text style={styles.footer}>
            Próximo paso: revisar el briefing y generar la propuesta.
          </Text>
        </Section>
        <Text style={styles.signature}>— Pragma Marketers · notificación interna</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewProspectEmail,
  subject: (d: Record<string, any>) => `🆕 Nuevo prospect: ${d?.prospectName || 'sin nombre'}`,
  displayName: 'Admin — nuevo prospect',
  to: PRAGMA_ADMIN_EMAILS[0],
  previewData: { prospectName: 'Carlos Ruiz', companyName: 'Clinica Sol', vertical: 'salud', subNiche: 'estetica', market: 'ES', adminUrl: 'https://pragma-brief-flow.lovable.app/admin/prospects' },
} satisfies TemplateEntry
