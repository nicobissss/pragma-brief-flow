/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles, PRAGMA_ADMIN_EMAILS } from './_pragma-styles.ts'

interface Props { clientName?: string; analysisType?: string; summary?: string; adminUrl?: string }

const ANALYSIS_LABELS: Record<string, string> = {
  competitors: 'análisis de competidores locales',
  winning_patterns: 'patrones ganadores',
  voc: 'voice of customer',
}

const DiscoveryReadyEmail = ({ clientName, analysisType, summary, adminUrl }: Props) => {
  const label = analysisType ? (ANALYSIS_LABELS[analysisType] || analysisType) : 'discovery'
  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Discovery listo: {label}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Section style={styles.card}>
            <Heading style={styles.h1}>🔍 Discovery completado</Heading>
            <Text style={styles.text}>
              El {label} para <strong>{clientName || 'el cliente'}</strong> está listo.
            </Text>
            {summary && (
              <Text style={styles.highlight}>{summary}</Text>
            )}
            {adminUrl && (
              <Button style={styles.button} href={adminUrl}>Ver resultado</Button>
            )}
          </Section>
          <Text style={styles.signature}>— Pragma Marketers · notificación interna</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: DiscoveryReadyEmail,
  subject: (d: Record<string, any>) => `🔍 Discovery listo: ${d?.clientName || 'cliente'}`,
  displayName: 'Admin — discovery listo',
  to: PRAGMA_ADMIN_EMAILS[0],
  previewData: { clientName: 'Ana López', analysisType: 'competitors', summary: '3 competidores analizados', adminUrl: 'https://pragma-brief-flow.lovable.app/admin/clients' },
} satisfies TemplateEntry
