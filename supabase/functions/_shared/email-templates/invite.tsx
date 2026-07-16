/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="cs" dir="ltr">
    <Head />
    <Preview>Pozvánka do {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brand}>
          <Text style={brandText}>{siteName}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Máš pozvánku</Heading>
          <Text style={text}>
            Byl/a jsi pozván/a do{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            . Klikni na tlačítko níže, přijmi pozvánku a vytvoř si účet.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Button style={button} href={confirmationUrl}>
              Přijmout pozvánku
            </Button>
          </Section>
          <Text style={footer}>
            Pokud jsi pozvánku nečekal/a, tento e-mail můžeš ignorovat.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: '#17E9FF', textDecoration: 'underline' }
const button = {
  backgroundColor: '#17E9FF',
  color: '#06090F',
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  letterSpacing: '1px',
  textTransform: 'uppercase' as const,
}
const footer = { fontSize: '12px', color: '#7A8A90', margin: '24px 0 0', lineHeight: '1.5' }
