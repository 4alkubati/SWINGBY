import { AccordionItem } from './Accordion'

export default function FAQItem({ question, answer }) {
  return (
    <AccordionItem title={question}>
      <p>{answer}</p>
    </AccordionItem>
  )
}

export function FAQSection({ items, jsonLd = true }) {
  const structuredData = jsonLd ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null

  return (
    <>
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
      <div>
        {items.map((item, i) => (
          <FAQItem key={i} question={item.question} answer={item.answer} />
        ))}
      </div>
    </>
  )
}
