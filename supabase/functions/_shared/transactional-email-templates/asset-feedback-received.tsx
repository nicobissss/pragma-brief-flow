/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles, PRAGMA_ADMIN_EMAILS } from './_pragma-styles.ts'

interface Props { clientName?: string; assetName?: string; assetType?: string; commentSummary?: string; adminUrl?: string }

const AssetFeedbackEmail = ({ clientName, assetName, assetType, commentSummary, adminUrl }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Nuevo feedback de cliente</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.card}>
          <Heading style={styles.h1}>Cambios solicitados</Heading>
          <Text style={styles.text}>
            <strong>{clientName || 'Un cliente'}</strong> ha pedido cambios en {assetName ? <strong>{assetName}</strong> : 'un asset'}{assetType ? ` (${assetType})` : ''}.
          </Text>
          {commentSummary && (
            <Text style={styles.highlight}>{commentSummary}</Text>
          )}
          {adminUrl && (
            <Button style={styles.button} href={adminUrl}>Abrir ficha cliente</Button>
          )}
          <Text style={styles.footer}>
            El sistema ya ha generado un correction prompt automático. Revísalo antes de regenerar.
          </Text>
        </Section>
        <Text style={styles.signature}>— Pragma Marketers · notificación interna</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AssetFeedbackEmail,
  subject: (d: Record<string, any>) => `🔁 Feedback: ${d?.clientName || 'cliente'} — ${d?.assetName || 'asset'}`,
  displayName: 'Admin — feedback recibido',
  to: PRAGMA_ADMIN_EMAILS[0],
  previewData: { clientName: 'Ana López', assetName: 'Landing Promo', assetType: 'landing_page', commentSummary: '3 comentarios de sección', adminUrl: 'https://pragma-brief-flow.lovable.app/admin/clients' },
} satisfies TemplateEntry
