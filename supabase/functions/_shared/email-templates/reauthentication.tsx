/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación de Pragma Marketers</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Confirma tu identidad</Heading>
          <Text style={text}>Usa el siguiente código para continuar:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Este código caduca en breve. Si no lo solicitaste, ignora este
            email.
          </Text>
        </Section>
        <Text style={signature}>— El equipo de Pragma Marketers</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif", padding: '40px 20px' }
const container = { maxWidth: '560px', margin: '0 auto' }
const card = { backgroundColor: '#F5F2EC', borderRadius: '16px', padding: '32px 28px', border: '1px solid #D9D3C8', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1A1C22', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#1A1C22', lineHeight: '1.6', margin: '0 0 18px' }
const codeStyle = { fontFamily: "'Courier New', monospace", fontSize: '32px', fontWeight: 'bold' as const, color: '#7BB8D4', letterSpacing: '8px', backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', margin: '0 0 24px' }
const footer = { fontSize: '13px', color: '#707480', margin: '20px 0 0', lineHeight: '1.5' }
const signature = { fontSize: '12px', color: '#707480', textAlign: 'center' as const, margin: '24px 0 0' }
