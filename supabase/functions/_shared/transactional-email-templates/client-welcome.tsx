/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'
import { styles } from './_pragma-styles.ts'

interface Props { name?: string; setPasswordUrl?: string; appUrl?: string }

const ClientWelcomeEmail = ({ name, setPasswordUrl, appUrl }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Bienvenido a Pragma Marketers</Preview>
    <Body style={styles.main}>
      <Container style={styles.container}>
        <Section style={styles.card}>
          <Heading style={styles.h1}>{name ? `¡Bienvenido, ${name}!` : '¡Bienvenido!'}</Heading>
          <Text style={styles.text}>
            Tu cuenta de cliente en Pragma Marketers está lista. Como primer paso, define tu contraseña para acceder a tu panel.
          </Text>
          {setPasswordUrl && (
            <Button style={styles.button} href={setPasswordUrl}>Definir mi contraseña</Button>
          )}
          <Text style={styles.footer}>
            Una vez dentro encontrarás tu kickoff, briefing y los próximos pasos. Si el botón no funciona, puedes acceder en {appUrl || 'la app'} y usar "¿Olvidaste tu contraseña?".
          </Text>
        </Section>
        <Text style={styles.signature}>— El equipo de Pragma Marketers</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ClientWelcomeEmail,
  subject: 'Bienvenido a Pragma Marketers — define tu contraseña',
  displayName: 'Cliente — bienvenida',
  previewData: { name: 'Ana', setPasswordUrl: 'https://pragma-brief-flow.lovable.app/update-password', appUrl: 'https://pragma-brief-flow.lovable.app' },
} satisfies TemplateEntry
