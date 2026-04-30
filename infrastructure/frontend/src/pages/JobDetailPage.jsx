import { useParams } from 'react-router-dom'

export default function JobDetailPage () {
  const { id } = useParams()
  return (
    <section>
      <h1>Job detail (stub)</h1>
      <p>
        Job ID:
        {' '}
        <code>{id}</code>
      </p>
    </section>
  )
}
