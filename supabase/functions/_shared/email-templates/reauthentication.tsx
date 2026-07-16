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
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Tvůj ověřovací kód</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Text style={brandText}>StudioVoxario</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Potvrď svou identitu</Heading>
          <Text style={text}>Pro ověření použij následující kód:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            Kód brzy vyprší. Pokud jsi o něj nežádal/a, tento e-mail můžeš ignorovat.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Rajdhani, Segoe UI, Arial, sans-serif' }
const container = { padding: '32px 20px', maxWidth: '560px', margin: '0 auto' }
const brand = { textAlign: 'center' as const, padding: '0 0 20px' }
const brandText = {
  fontFamily: 'Orbitron, Arial, sans-serif',
  fontSize: '22px',
  fontWeight: 800 as const,
  letterSpacing: '2px',
  color: '#06090F',
  margin: 0,
}
const card = {
  backgroundColor: '#06090F',
  border: '1px solid #17E9FF',
  borderRadius: '10px',
  padding: '32px 28px',
  boxShadow: '0 0 24px rgba(23,233,255,0.25)',
  textAlign: 'center' as const,
}
const h1 = {
  fontFamily: 'Orbitron, Arial, sans-serif',
  fontSize: '24px',
  fontWeight: 700 as const,
  color: '#17E9FF',
  margin: '0 0 20px',
  letterSpacing: '1px',
}
const text = { fontSize: '15px', color: '#DDEEF2', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = {
  fontFamily: '"Share Tech Mono", Courier, monospace',
  fontSize: '32px',
  fontWeight: 700 as const,
  color: '#17E9FF',
  letterSpacing: '8px',
  margin: '20px 0 24px',
  textShadow: '0 0 12px rgba(23,233,255,0.6)',
}
const footer = { fontSize: '12px', color: '#7A8A90', margin: '24px 0 0', lineHeight: '1.5' }
