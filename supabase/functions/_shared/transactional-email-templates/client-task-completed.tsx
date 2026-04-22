/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles, PRAGMA_ADMIN_EMAILS } from './_pragma-styles.ts'

interface Props { clientName?: string; taskTitle?: string; offeringName?: string; adminUrl?: string }

const TaskCompletedEmail = ({ clientName, taskTitle, offeringName, adminUrl }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tarea completada por cliente</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.card}>
          <Heading style={styles.h1}>☑️ Tarea completada</Heading>
          <Text style={styles.text}>
            <strong>{clientName || 'Un cliente'}</strong> ha marcado como completada la tarea {taskTitle ? <strong>"{taskTitle}"</strong> : ''}{offeringName ? ` del paquete ${offeringName}` : ''}.
          </Text>
          {adminUrl && (
            <Button style={styles.button} href={adminUrl}>Ver action plan</Button>
          )}
          <Text style={styles.footer}>
            Verifica el resultado y continúa con la siguiente fase si procede.
          </Text>
        </Section>
        <Text style={styles.signature}>— Pragma Marketers · notificación interna</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TaskCompletedEmail,
  subject: (d: Record<string, any>) => `☑️ ${d?.clientName || 'Cliente'} completó: ${d?.taskTitle || 'una tarea'}`,
  displayName: 'Admin — task completada por cliente',
  to: PRAGMA_ADMIN_EMAILS[0],
  previewData: { clientName: 'Ana López', taskTitle: 'Subir logos', offeringName: 'Setup inicial', adminUrl: 'https://pragma-brief-flow.lovable.app/admin/clients' },
} satisfies TemplateEntry
