import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import ptBr from 'date-fns/locale/pt-BR';
import Notification from '../schemas/Notification'
import Queue from '../lib/Queue';
import CancellationMail from '../jobs/CancellationMail';

const index = async({ Appointment, User, File }, req, res) => {
  const { page = 1 } = req.query;

  const appointments = await Appointment.findAll({
    where: { user_id: req.user.id, canceled_at: null },
    order: ['date'],
    attributes: ['id', 'date', 'past', 'cancelable'],
    limit: 20,
    offset: (page - 1) * 20,
    include: [{ 
      model: User,
      as: 'provider',
      attributes: ['id', 'name'],
      include: [{
        model: File,
        as: 'avatar',
        attributes: ['id', 'path', 'url']
      }]
     }]
  })
  return res.json(appointments)
}

const store = async({ Appointment, User }, req, res) => {
  const schema = Yup.object().shape({
    provider_id: Yup.number().required(),
    date: Yup.date().required()
  })

  if (!(await schema.isValid(req.body))) {
    return res.status(400).json({ error: 'Validation fails.' })
  }

  const { provider_id, date } = req.body;

  /**
   * Check if provider is provider
   */
  const isProvider = await User.findOne({
    where: { id: provider_id, provider: true }
  })
  if (!isProvider) {
    return res.status(401).json({ error: 'You can only create appointments with providers' })
  }

  /**
   * Check if the customer is the service provider
   */
  if (provider_id === req.user.id) {
    return res.status(401).json({ error: 'You cannot schedule a service for yourself.' })
  }

  /**
   * Check for past dates 
   */
  const hourStart = startOfHour(parseISO(date));
  if (isBefore(hourStart, new Date())) {
    return res.status(400).json({ error: 'Past dates are not permited.' })
  }
  
  /**
   * Check date availability
   */
  const notDateAvailable = await Appointment.findOne({
    where: { provider_id, canceled_at: null, date: hourStart }
  })
  if (notDateAvailable) {
    return res.status(400).json({ error: 'Appointment date no available.' })
  }

  const appointment = await Appointment.create({
    user_id: req.user.id,
    provider_id,
    date
  })

  /**
   * Notify appointment provider
   */
  const formattedDate = format(hourStart, "'dia' dd 'de' MMMM', às' H:mm'h'", { locale: ptBr })
  await Notification.create({
    content: `Novo agendamento de ${req.user.name} para ${formattedDate}`,
    user: provider_id
  })

  return res.json(appointment);
}

const remove = async({ Appointment, User }, req, res) => {
  const appointment = await Appointment.findByPk(req.params.id, {
    include: [{ model: User, as: 'provider', attributes: ['name', 'email'] }]
  });

  if (appointment.user_id !== req.user.id) {
    return res.status(401).json({ error: "You don't have permission to cancel this appointment." })
  }

  /**
   * Check if the schedule date is less than two hours
  */
  const dateWithSub = subHours(appointment.date, 2);
  if (isBefore(dateWithSub, new Date())) {
    return res.status(401).json({ error: 'You can only cancel appointments 2 hours in advance.' })
  }

  appointment.canceled_at = new Date();
  await appointment.save();

  await Queue.add(CancellationMail.key, { appointment, user: req.user });

  return res.json(appointment);
}

export default { store, index, remove }