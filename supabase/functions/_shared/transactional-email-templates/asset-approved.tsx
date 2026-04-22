/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles, PRAGMA_ADMIN_EMAILS } from './_pragma-styles.ts'

interface Props { clientName?: string; assetName?: string; assetType?: string; adminUrl?: string }

const AssetApprovedEmail = ({ clientName, assetName, assetType, adminUrl }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Asset aprobado por el cliente</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.card}>
          <Heading style={styles.h1}>✅ Asset aprobado</Heading>
          <Text style={styles.text}>
            <strong>{clientName || 'Un cliente'}</strong> ha aprobado {assetName ? <strong>{assetName}</strong> : 'un asset'}{assetType ? ` (${assetType})` : ''}.
          </Text>
          {adminUrl && (
            <Button style={styles.button} href={adminUrl}>Ver ficha cliente</Button>
          )}
          <Text style={styles.footer}>
            Ya puedes pasar a la siguiente fase de producción o publicación.
          </Text>
        </Section>
        <Text style={styles.signature}>— Pragma Marketers · notificación interna</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AssetApprovedEmail,
  subject: (d: Record<string, any>) => `✅ Aprobado por ${d?.clientName || 'cliente'}: ${d?.assetName || 'asset'}`,
  displayName: 'Admin — asset aprobado',
  to: PRAGMA_ADMIN_EMAILS[0],
  previewData: { clientName: 'Ana López', assetName: 'Landing Promo', assetType: 'landing_page', adminUrl: 'https://pragma-brief-flow.lovable.app/admin/clients' },
} satisfies TemplateEntry
