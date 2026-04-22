/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles } from './_pragma-styles.ts'

interface Props { name?: string; assetType?: string; assetName?: string; reviewUrl?: string }

const ASSET_LABELS: Record<string, string> = {
  landing_page: 'landing page',
  email_flow: 'flujo de emails',
  social_post: 'posts sociales',
  blog_article: 'artículo de blog',
}

const AssetReadyEmail = ({ name, assetType, assetName, reviewUrl }: Props) => {
  const label = assetType ? (ASSET_LABELS[assetType] || assetType) : 'asset'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Tienes {label} listos para revisar</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Heading style={styles.h1}>{name ? `Hola ${name},` : 'Hola,'}</Heading>
            <Text style={styles.text}>
              Hemos preparado tu {label} y ya puedes revisarlo en tu panel.
            </Text>
            {assetName && (
              <Text style={styles.highlight}><strong>{assetName}</strong></Text>
            )}
            {reviewUrl && (
              <Button style={styles.button} href={reviewUrl}>Revisar ahora</Button>
            )}
            <Text style={styles.footer}>
              Puedes aprobarlo o dejar comentarios sección por sección. Cuanto antes nos llegue tu feedback, antes pasamos a la siguiente fase.
            </Text>
          </Section>
          <Text style={styles.signature}>— El equipo de Pragma Marketers</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AssetReadyEmail,
  subject: (d: Record<string, any>) => d?.assetName ? `Listo para revisar: ${d.assetName}` : 'Tienes contenido listo para revisar',
  displayName: 'Asset listo para revisión',
  previewData: { name: 'Ana', assetType: 'landing_page', assetName: 'Landing — Promo Verano', reviewUrl: 'https://pragma-brief-flow.lovable.app' },
} satisfies TemplateEntry
