import * as Yup from 'yup';

const store = async (User, req, res) => {
    const schema = Yup.object().shape({
        name: Yup.string().required(),
        email: Yup.string().email().required(),
        password: Yup.string().required().min(6)
    }) 

    if (!(await schema.isValid(req.body))) {
        return res.status(400).json({ error: 'Validations fails.' })
    }

    const userExists = await User.findOne({ where: {email: req.body.email} });
    if (userExists) {
        return res.status(400).json({ error: 'User not available.' })
    }
    const { id, name, email, provider } = await User.create(req.body);
    return res.json({ id, name, email, provider });
}

const update = async ({ User, File }, req, res) => {
    const schema = Yup.object().shape({
        name: Yup.string(),
        email: Yup.string().email(),
        oldPassword: Yup.string().min(6),
        password: Yup.string().min(6)
            .when('oldPassword', (oldPassword, field) =>
                oldPassword ? field.required() : field 
            ),
        confirmPassword: Yup.string()
            .when('password', (password, field) =>
                password ? field.required().oneOf([Yup.ref('password')]) : field
            )    
    }) 

    if (!(await schema.isValid(req.body))) {
        return res.status(400).json({ error: 'Validations fails.' })
    }

    const user = await User.findByPk(req.user.id);

    if (req.body.email && req.body.email !== user.email) {
        const userExists = await User.findOne({ where: {email: req.body.email} });
        if (userExists) {
            return res.status(400).json({ error: 'User not available.' });
        }
    }

    if (req.body.oldPassword && !(await user.checkPassword(req.body.oldPassword))) {
        return res.status(401).json({ error: 'Wrong credentials.' })
    }

    await user.update(req.body);

    const { id, name, email, avatar } = await User.findByPk(req.user.id, {
        include: [{  model: File, as: 'avatar', attributes: ['id', 'path', 'url'] }]
    })

    return res.json({ id, name, email, avatar });
}

export default { store, update }