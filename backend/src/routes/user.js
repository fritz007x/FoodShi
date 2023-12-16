// User registration
router.post("/users", (req, res) => {
  // Validate the request body
  if (!req.body.name || !req.body.email || !req.body.password) {
    res.status(400).send("Invalid request body");
    return;
  }

  // Create a new user
  const user = new User({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
  });

  // Save the user
  user.save((err, user) => {
    if (err) {
      res.status(500).send(err);
      return;
    }

    // Successfully created a new user
    res.status(201).json(user);
  });
});
