/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu enlace de acceso a Pragma Marketers</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Tu enlace de acceso</Heading>
          <Text style={text}>
            Haz clic en el botón para entrar en Pragma Marketers. El enlace
            caduca en breve.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Acceder
          </Button>
          <Text style={footer}>
            Si no solicitaste este enlace, ignora este email.
          </Text>
        </Section>
        <Text style={signature}>— El equipo de Pragma Marketers</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif", padding: '40px 20px' }
const container = { maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#F5F2EC', borderRadius: '16px', padding: '32px 28px', border: '1px solid #D9D3C8' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1C22', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1A1C22', lineHeight: '1.6', margin: '0 0 18px' }
const button = { backgroundColor: '#7BB8D4', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '12px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block', margin: '8px 0 24px' }
const footer = { fontSize: '13px', color: '#707480', margin: '20px 0 0', lineHeight: '1.5' }
const signature = { fontSize: '12px', color: '#707480', textAlign: 'center' as const, margin: '24px 0 0' }
