import * as Yup from 'yup';

const store = async({ Appointment, User }, req, res) => {
  const schema = Yup.object().shape({
    provider_id: Yup.number().required(),
    date: Yup.date().required()
  })

  if (!(await schema.isValid(req.body))) {
    return res.status(400).json({ error: 'Validation fails.' })
  }

  const { provider_id, date } = req.body;

  const isProvider = await User.findOne({
    where: { id: provider_id, provider: true }
  })

  if (!isProvider) {
    return res.status(401).json({ error: 'You can only create appointments with providers' })
  }

  const appointment = await Appointment.create({
    user_id: req.user.id,
    provider_id,
    date
  })

  return res.json(appointment);
}

export default { store }