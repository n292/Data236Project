import { useParams } from 'react-router-dom'

export default function RecruiterJobEditPage () {
  const { id } = useParams()
  return (
    <section>
      <h1>Edit job posting (stub)</h1>
      <p>
        Job ID:
        {' '}
        <code>{id}</code>
      </p>
    </section>
  )
}
